package services

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/rs/zerolog/log"
)

// ── Request / response shapes ─────────────────────────────────────────────

type ChatMessage struct {
	Role    string `json:"role"` // "user" | "assistant"
	Content string `json:"content"`
}

type DiagramNode struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	ComponentID string `json:"componentId,omitempty"`
	Description string `json:"description,omitempty"`
}

type DiagramEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type DiagramChaos struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	NodeID    string                 `json:"nodeId"`
	Params    map[string]interface{} `json:"params,omitempty"`
	InjectedAt int64                 `json:"injectedAt,omitempty"`
}

type DiagramMetrics struct {
	NodeID      string  `json:"nodeId"`
	RPS         float64 `json:"rps,omitempty"`
	LatencyAvg  float64 `json:"latencyAvg,omitempty"`
	ErrorRate   float64 `json:"errorRate,omitempty"`
	CPUPercent  float64 `json:"cpuPercent,omitempty"`
	IsBottleneck bool   `json:"isBottleneck,omitempty"`
}

type DiagramContext struct {
	Nodes      []DiagramNode    `json:"nodes"`
	Edges      []DiagramEdge    `json:"edges"`
	Selection  []string         `json:"selection"`
	Chaos      []DiagramChaos   `json:"chaos"`
	Metrics    []DiagramMetrics `json:"metrics,omitempty"`
}

type CanvasChatRequest struct {
	Messages []ChatMessage  `json:"messages"`
	Diagram  DiagramContext `json:"diagram"`
	Canvas   string         `json:"canvas"` // "excalidraw" | "flow"
}

const canvasChatSystemPrompt = `You are Archly's architecture assistant. You help users understand their system design diagram and run chaos experiments.

You can:
1. Explain what nodes do, how they connect, and what bottlenecks mean.
2. Suggest and apply chaos experiments on nodes.

You CANNOT add, remove, or rewire nodes. If asked to redesign the architecture, explain briefly and tell them to use the AI Generate (Mermaid) panel.

Chaos types (exactly these):
- crash — kill the node (RPS=0, errors)
- slow — inject latency (params.latencyMs, default 500)
- surge — traffic spike (params.surgeMultiplier, default 10)
- partition — network partition from dependencies
- throttle — bandwidth cap (params.throttleKbps, default 100)
- canary — asymmetric canary traffic (params.canaryPercent, default 10)
- zero — zero-weight / black hole (no traffic)

When the user asks to inject, remove, or clear chaos, end your reply with an actions fence AFTER a short confirmation in plain prose:

` + "```actions" + `
{"actions":[{"type":"inject_chaos","nodeId":"<id>","chaosType":"crash","params":{}},{"type":"remove_chaos","injectionId":"<id>"},{"type":"clear_chaos"}]}
` + "```" + `

Rules for actions:
- Prefer exact nodeId from the diagram context. If the user names a label, resolve to the matching node id.
- Only emit actions when the user clearly wants a change. Pure questions get prose only — no actions fence.
- Never invent node ids that are not in the diagram.
- Keep prose concise (2–6 sentences). Do not put JSON in the prose section.
- Use selection when the user says "this" / "selected" without naming a node.`

var actionsFenceRE = regexp.MustCompile("(?s)```(?:actions|json)\\s*\\n(\\{.*?\"actions\".*?\\})\\s*```")
var bareActionsRE = regexp.MustCompile(`(?s)(\{\s*"actions"\s*:\s*\[.*?\]\s*\})\s*$`)

// CanvasChatStream answers a diagram-aware chat turn and streams SSE:
//   event: token  — prose chunks
//   event: actions — {"actions":[...]} when present
//   data: [DONE]
func (s *AIService) CanvasChatStream(ctx context.Context, req CanvasChatRequest, userID string, w http.ResponseWriter) error {
	if len(req.Messages) == 0 {
		return fmt.Errorf("messages required")
	}
	if req.Canvas == "" {
		req.Canvas = "excalidraw"
	}

	userPayload := buildCanvasChatUserPayload(req)

	var full string
	var err error

	if s.cfg.GeminiAPIKey != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "gemini").
			Str("model", s.cfg.GeminiModel).
			Str("canvas", req.Canvas).
			Int("nodes", len(req.Diagram.Nodes)).
			Msg("ai: CanvasChatStream — trying Gemini")

		full, err = s.geminiChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
		if err == nil {
			return s.writeCanvasChatSSE(w, full)
		}
		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", userID).Msg("ai: Gemini quota exceeded — falling back to OpenRouter for canvas chat")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: Gemini canvas chat failed — falling back to OpenRouter")
		}
	}

	if s.cfg.OpenRouterAPIKey != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "openrouter").
			Str("model", s.cfg.OpenRouterModel).
			Msg("ai: CanvasChatStream — trying OpenRouter")

		full, err = s.openRouterChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
		if err == nil {
			return s.writeCanvasChatSSE(w, full)
		}
		log.Error().Err(err).Str("user_id", userID).Msg("ai: OpenRouter canvas chat failed")
		return err
	}

	return ErrAIUnavailable
}

func buildCanvasChatUserPayload(req CanvasChatRequest) string {
	diagramJSON, _ := json.Marshal(req.Diagram)
	var b strings.Builder
	b.WriteString("Canvas: ")
	b.WriteString(req.Canvas)
	b.WriteString("\n\nCurrent diagram context (JSON):\n")
	b.Write(diagramJSON)
	b.WriteString("\n\nConversation:\n")
	for _, m := range req.Messages {
		role := m.Role
		if role != "user" && role != "assistant" {
			role = "user"
		}
		b.WriteString(strings.ToUpper(role))
		b.WriteString(": ")
		b.WriteString(m.Content)
		b.WriteString("\n")
	}
	b.WriteString("\nRespond as ASSISTANT. Prose first; actions fence only if mutating chaos.")
	return b.String()
}

func splitProseAndActions(raw string) (prose string, actionsJSON string) {
	raw = strings.TrimSpace(raw)
	if m := actionsFenceRE.FindStringSubmatchIndex(raw); m != nil {
		prose = strings.TrimSpace(raw[:m[0]] + raw[m[1]:])
		actionsJSON = strings.TrimSpace(raw[m[2]:m[3]])
		return prose, actionsJSON
	}
	if m := bareActionsRE.FindStringSubmatchIndex(raw); m != nil {
		prose = strings.TrimSpace(raw[:m[2]])
		actionsJSON = strings.TrimSpace(raw[m[2]:m[3]])
		return prose, actionsJSON
	}
	return raw, ""
}

func sanitizeActionsJSON(raw string) string {
	if raw == "" {
		return ""
	}
	var envelope struct {
		Actions []map[string]interface{} `json:"actions"`
	}
	if err := json.Unmarshal([]byte(raw), &envelope); err != nil {
		log.Warn().Err(err).Str("raw", truncate(raw, 200)).Msg("ai: canvas chat actions JSON invalid — dropping")
		return ""
	}
	allowed := map[string]bool{
		"inject_chaos": true,
		"remove_chaos": true,
		"clear_chaos":  true,
	}
	filtered := make([]map[string]interface{}, 0, len(envelope.Actions))
	for _, a := range envelope.Actions {
		t, _ := a["type"].(string)
		if !allowed[t] {
			continue
		}
		filtered = append(filtered, a)
	}
	if len(filtered) == 0 {
		return ""
	}
	out, err := json.Marshal(map[string]interface{}{"actions": filtered})
	if err != nil {
		return ""
	}
	return string(out)
}

func (s *AIService) writeCanvasChatSSE(w http.ResponseWriter, full string) error {
	prose, actionsRaw := splitProseAndActions(full)
	actions := sanitizeActionsJSON(actionsRaw)

	writeSSEHeaders(w)
	flusher, canFlush := w.(http.Flusher)

	// Stream prose in small chunks for snappy UX
	const chunkSize = 48
	for i := 0; i < len(prose); i += chunkSize {
		end := i + chunkSize
		if end > len(prose) {
			end = len(prose)
		}
		chunk := prose[i:end]
		fmt.Fprintf(w, "event: token\n")
		writeSSELines(w, chunk)
		if canFlush {
			flusher.Flush()
		}
	}

	if actions != "" {
		fmt.Fprintf(w, "event: actions\n")
		fmt.Fprintf(w, "data: %s\n\n", actions)
		if canFlush {
			flusher.Flush()
		}
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	if canFlush {
		flusher.Flush()
	}

	log.Info().
		Int("prose_len", len(prose)).
		Bool("has_actions", actions != "").
		Msg("ai: CanvasChatStream complete")
	return nil
}

// geminiChatCollect streams from Gemini into a string (no client headers yet).
func (s *AIService) geminiChatCollect(ctx context.Context, userID, system, user string) (string, error) {
	reqBody, _ := json.Marshal(geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: system}},
		},
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: user}}},
		},
		GenerationConfig: map[string]interface{}{
			"maxOutputTokens": 1500,
			"temperature":     0.3,
		},
	})

	url := fmt.Sprintf("%s/%s:streamGenerateContent?alt=sse&key=%s",
		geminiBaseURL, s.cfg.GeminiModel, s.cfg.GeminiAPIKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			return "", ErrAIQuotaExceeded
		}
		return "", fmt.Errorf("gemini %d: %s", resp.StatusCode, truncate(string(body), 400))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	// Gemini chunks can be large
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk geminiStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		for _, candidate := range chunk.Candidates {
			for _, part := range candidate.Content.Parts {
				if part.ThoughtSignature != "" || part.Text == "" {
					continue
				}
				full.WriteString(part.Text)
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return full.String(), err
	}
	if full.Len() == 0 {
		log.Warn().Str("user_id", userID).Msg("ai: Gemini canvas chat returned empty")
		return "", errors.New("empty Gemini response")
	}
	return full.String(), nil
}

func (s *AIService) openRouterChatCollect(ctx context.Context, userID, system, user string) (string, error) {
	reqBody, _ := json.Marshal(orRequest{
		Model: s.cfg.OpenRouterModel,
		Messages: []orMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Stream:      true,
		MaxTokens:   1500,
		Temperature: 0.3,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build openrouter request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.OpenRouterAPIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openrouter http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			return "", ErrAIQuotaExceeded
		}
		return "", fmt.Errorf("openrouter %d: %s", resp.StatusCode, truncate(string(body), 400))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk orStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		for _, choice := range chunk.Choices {
			if choice.Delta.Content != "" {
				full.WriteString(choice.Delta.Content)
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return full.String(), err
	}
	if full.Len() == 0 {
		log.Warn().Str("user_id", userID).Msg("ai: OpenRouter canvas chat returned empty")
		return "", errors.New("empty OpenRouter response")
	}
	return full.String(), nil
}
