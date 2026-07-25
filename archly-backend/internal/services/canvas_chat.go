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
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	NodeID     string                 `json:"nodeId"`
	Params     map[string]interface{} `json:"params,omitempty"`
	InjectedAt int64                  `json:"injectedAt,omitempty"`
}

type DiagramMetrics struct {
	NodeID       string  `json:"nodeId"`
	RPS          float64 `json:"rps,omitempty"`
	LatencyAvg   float64 `json:"latencyAvg,omitempty"`
	ErrorRate    float64 `json:"errorRate,omitempty"`
	CPUPercent   float64 `json:"cpuPercent,omitempty"`
	IsBottleneck bool    `json:"isBottleneck,omitempty"`
}

type DiagramContext struct {
	Nodes     []DiagramNode    `json:"nodes"`
	Edges     []DiagramEdge    `json:"edges"`
	Selection []string         `json:"selection"`
	Chaos     []DiagramChaos   `json:"chaos"`
	Metrics   []DiagramMetrics `json:"metrics,omitempty"`
}

type CanvasChatRequest struct {
	Messages []ChatMessage  `json:"messages"`
	Diagram  DiagramContext `json:"diagram"`
	Canvas   string         `json:"canvas"`   // "excalidraw" | "flow"
	Provider string         `json:"provider"` // "ollama" | "groq" | "github" | "openrouter" | "" (auto)
}

const canvasChatSystemPrompt = `You are Archly's architecture assistant. You help users understand their system design diagram and run chaos experiments.

You can:
1. Explain what nodes do, how they connect, and what bottlenecks mean.
2. Suggest and apply chaos experiments on nodes.
3. On the Flow canvas, add, remove, connect, disconnect, and relabel nodes.

Chaos types (exactly these):
- crash — kill the node (RPS=0, errors)
- slow — inject latency (params.latencyMs, default 500)
- surge — traffic spike (params.surgeMultiplier, default 10)
- partition — network partition from dependencies
- throttle — bandwidth cap (params.throttleKbps, default 100)
- canary — asymmetric canary traffic (params.canaryPercent, default 10)
- zero — zero-weight / black hole (no traffic)

When the user asks to mutate the diagram or inject, remove, or clear chaos, end your reply with an actions fence AFTER a short confirmation in plain prose:

` + "```actions" + `
{"actions":[{"type":"add_node","componentId":"cache","label":"Redis","x":500,"y":200},{"type":"remove_node","nodeId":"<id>"},{"type":"connect","source":"<id>","target":"<id>"},{"type":"disconnect","source":"<id>","target":"<id>"},{"type":"relabel","nodeId":"<id>","label":"New label"},{"type":"inject_chaos","nodeId":"<id>","chaosType":"crash","params":{}},{"type":"remove_chaos","injectionId":"<id>"},{"type":"clear_chaos"}]}
` + "```" + `

Rules for actions:
- Prefer exact nodeId from the diagram context. If the user names a label, resolve to the matching node id.
- Diagram mutation actions are supported on Flow. For add_node, use a componentId represented in the diagram context when possible; source/target may also be supplied as sourceLabel/targetLabel.
- Only emit actions when the user clearly wants a change. Pure questions get prose only — no actions fence.
- Never invent node ids that are not in the diagram; newly added nodes should be referenced by their requested labels in later actions.
- Keep prose concise (2–6 sentences). Do not put JSON in the prose section.
- Use selection when the user says "this" / "selected" without naming a node.`

var actionsFenceRE = regexp.MustCompile("(?s)```(?:actions|json)\\s*\\n(\\{.*?\"actions\".*?\\})\\s*```")
var bareActionsRE = regexp.MustCompile(`(?s)(\{\s*"actions"\s*:\s*\[.*?\]\s*\})\s*$`)

// CanvasChatStream answers a diagram-aware chat turn and streams SSE:
//
//	event: token  — prose chunks
//	event: actions — {"actions":[...]} when present
//	data: [DONE]
func (s *AIService) CanvasChatStream(ctx context.Context, req CanvasChatRequest, userID string, w http.ResponseWriter) error {
	if len(req.Messages) == 0 {
		return fmt.Errorf("messages required")
	}
	if req.Canvas == "" {
		req.Canvas = "excalidraw"
	}

	userPayload := buildCanvasChatUserPayload(req)
	provider := strings.TrimSpace(strings.ToLower(req.Provider))

	// ── Provider pinning ──────────────────────────────────────────────────
	switch provider {
	case "ollama":
		if s.cfg.OllamaBaseURL != "" {
			log.Info().Str("user_id", userID).Str("provider", "ollama").Msg("ai: canvas chat pinned to Ollama")
			full, err := s.ollamaChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
			if err != nil {
				return err
			}
			return s.writeCanvasChatSSE(w, full)
		}
		log.Warn().Str("user_id", userID).Msg("ai: ollama requested but OLLAMA_BASE_URL not set — falling through")
	case "groq":
		if s.cfg.GroqAPIKey != "" {
			log.Info().Str("user_id", userID).Str("provider", "groq").Msg("ai: canvas chat pinned to Groq")
			full, err := s.groqChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
			if err != nil {
				return err
			}
			return s.writeCanvasChatSSE(w, full)
		}
		log.Warn().Str("user_id", userID).Msg("ai: groq requested but key not set — falling through")
	case "github":
		if s.cfg.GitHubModelsToken != "" {
			log.Info().Str("user_id", userID).Str("provider", "github").Msg("ai: canvas chat pinned to GitHub Models")
			full, err := s.openaiCompatChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload,
				githubModelsURL, s.cfg.GitHubModelsModel, s.cfg.GitHubModelsToken, "github")
			if err != nil {
				return err
			}
			return s.writeCanvasChatSSE(w, full)
		}
		log.Warn().Str("user_id", userID).Msg("ai: github requested but token not set — falling through")
	case "openrouter":
		if s.cfg.OpenRouterAPIKey != "" {
			log.Info().Str("user_id", userID).Str("provider", "openrouter").Msg("ai: canvas chat pinned to OpenRouter")
			full, err := s.openRouterChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
			if err != nil {
				return err
			}
			return s.writeCanvasChatSSE(w, full)
		}
		log.Warn().Str("user_id", userID).Msg("ai: openrouter requested but key not set — falling through")
	}

	// ── Auto fallback: Ollama → Groq → OpenRouter ───────────────────────
	var full string
	var err error

	if s.cfg.OllamaBaseURL != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "ollama").
			Str("model", s.cfg.OllamaModel).
			Str("canvas", req.Canvas).
			Int("nodes", len(req.Diagram.Nodes)).
			Msg("ai: CanvasChatStream — trying Ollama")

		full, err = s.ollamaChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
		if err == nil {
			return s.writeCanvasChatSSE(w, full)
		}
		log.Warn().Err(err).Str("user_id", userID).Msg("ai: Ollama canvas chat failed — falling back")
	}

	if s.cfg.GroqAPIKey != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "groq").
			Str("model", s.cfg.GroqModel).
			Str("canvas", req.Canvas).
			Int("nodes", len(req.Diagram.Nodes)).
			Msg("ai: CanvasChatStream — trying Groq")

		full, err = s.groqChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload)
		if err == nil {
			return s.writeCanvasChatSSE(w, full)
		}
		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", userID).Msg("ai: Groq quota exceeded — falling back to GitHub Models for canvas chat")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: Groq canvas chat failed — falling back to GitHub Models")
		}
	}

	if s.cfg.GitHubModelsToken != "" {
		log.Info().Str("user_id", userID).Str("provider", "github").
			Str("model", s.cfg.GitHubModelsModel).Msg("ai: CanvasChatStream — trying GitHub Models")
		full, err = s.openaiCompatChatCollect(ctx, userID, canvasChatSystemPrompt, userPayload,
			githubModelsURL, s.cfg.GitHubModelsModel, s.cfg.GitHubModelsToken, "github")
		if err == nil {
			return s.writeCanvasChatSSE(w, full)
		}
		log.Warn().Err(err).Str("user_id", userID).Msg("ai: GitHub Models canvas chat failed — falling back to OpenRouter")
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
	b.WriteString("\nRespond as ASSISTANT. Prose first; actions fence only if mutating the diagram or chaos.")
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
		"add_node":     true,
		"remove_node":  true,
		"connect":      true,
		"disconnect":   true,
		"relabel":      true,
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

// groqChatCollect collects from Groq into a string using the OpenAI-compatible API.
func (s *AIService) groqChatCollect(ctx context.Context, userID, system, user string) (string, error) {
	return s.openaiCompatChatCollect(ctx, userID, system, user, groqURL, s.cfg.GroqModel, s.cfg.GroqAPIKey, "groq")
}

func (s *AIService) openRouterChatCollect(ctx context.Context, userID, system, user string) (string, error) {
	return s.openaiCompatChatCollect(ctx, userID, system, user, openRouterURL, s.cfg.OpenRouterModel, s.cfg.OpenRouterAPIKey, "openrouter")
}

func (s *AIService) ollamaChatCollect(ctx context.Context, userID, system, user string) (string, error) {
	url := strings.TrimRight(s.cfg.OllamaBaseURL, "/") + "/v1/chat/completions"
	return s.openaiCompatChatCollect(ctx, userID, system, user, url, s.cfg.OllamaModel, "", "ollama")
}

func (s *AIService) openaiCompatChatCollect(ctx context.Context, userID, system, user, url, model, apiKey, provider string) (string, error) {
	reqBody, _ := json.Marshal(orRequest{
		Model: model,
		Messages: []orMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Stream:      true,
		MaxTokens:   1500,
		Temperature: 0.3,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build %s request: %w", provider, err)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("%s http: %w", provider, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			return "", ErrAIQuotaExceeded
		}
		return "", fmt.Errorf("%s %d: %s", provider, resp.StatusCode, truncate(string(body), 400))
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
		log.Warn().Str("user_id", userID).Str("provider", provider).Msg("ai: canvas chat returned empty")
		return "", fmt.Errorf("empty %s response", provider)
	}
	return full.String(), nil
}
