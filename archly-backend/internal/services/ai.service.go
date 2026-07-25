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
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/archly/api/internal/config"
	"github.com/archly/api/internal/kafka"
	"github.com/archly/api/internal/kafka/topics"
)

var ErrAIUnavailable = errors.New("AI service unavailable — no AI provider configured")
var ErrAIQuotaExceeded = errors.New("AI quota exceeded")

// OpenAI-compatible endpoints
const (
	openRouterURL   = "https://openrouter.ai/api/v1/chat/completions"
	githubModelsURL = "https://models.inference.ai.azure.com/chat/completions"
	groqURL         = "https://api.groq.com/openai/v1/chat/completions"
)

// AIService manages all AI provider calls.
type AIService struct {
	cfg      *config.Config
	client   *http.Client
	producer kafka.Producer
}

func NewAIService(cfg *config.Config, producer kafka.Producer) *AIService {
	return &AIService{
		cfg:      cfg,
		client:   &http.Client{Timeout: 8 * time.Minute},
		producer: producer,
	}
}

// ── OpenAI-compatible request/response shapes (shared by all providers) ───

type orMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type orRequest struct {
	Model       string      `json:"model"`
	Messages    []orMessage `json:"messages"`
	Stream      bool        `json:"stream"`
	MaxTokens   int         `json:"max_tokens,omitempty"`
	Temperature float64     `json:"temperature,omitempty"`
}

type orStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

// diagramSystemPrompt is used for cloud providers that have no Modelfile.
// Ollama uses the archly-architect Modelfile SYSTEM instead (see ollamaStream).
const diagramSystemPrompt = `You are an expert distributed-systems architect. Output ONLY Mermaid flowchart syntax for a production SYSTEM ARCHITECTURE diagram.

STRICT RULES:
- Start with exactly: flowchart TD
- No prose, markdown fences, comments, or subgraph blocks
- This is INFRASTRUCTURE architecture (clients, CDN, LB, API gateway, services, DBs, caches, queues, workers, observability) — NEVER a product journey, onboarding funnel, lesson plan, or business process
- Target 40–55 nodes and 45–70 labeled edges
- Include: edge/CDN, gateway, auth, multiple app services, primary+replica or polyglot DBs, Redis caches, Kafka/queues + workers, object storage, search if relevant, notifications, metrics/logs/traces
- Label every arrow with protocol or action (HTTPS, gRPC, async, reads, writes, publishes, cache miss, …)
- Use shapes: [svc] [(db)] ([cache]) [/cdn or s3/] {{lb/gateway}} >queue]
- Never stop early — emit the full architecture`

func diagramUserPrompt(prompt string) string {
	return fmt.Sprintf(
		`Design the production system architecture for: %s

Interpret product names (e.g. Unacademy, Uber, Twitter) as the real-world platform's backend — NOT a curriculum or UX flow.

Output ONLY Mermaid starting with "flowchart TD". Aim for 40–55 infrastructure nodes. No subgraphs. No other text.`,
		prompt,
	)
}

// ── TextToDiagramStream ───────────────────────────────────────────────────

// TextToDiagramStream streams Mermaid syntax to w.
// Chain: Ollama → Groq → GitHub Models → OpenRouter
// If provider is set, skips straight to that provider.
func (s *AIService) TextToDiagramStream(ctx context.Context, prompt, userID, provider string, w http.ResponseWriter) error {
	systemPrompt := diagramSystemPrompt
	userMessage := diagramUserPrompt(prompt)

	// ── Provider pinning ─────────────────────────────────────────────────
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case "ollama":
		if s.cfg.OllamaBaseURL != "" {
			log.Info().Str("user_id", userID).Str("provider", "ollama").Msg("ai: pinned to Ollama")
			tokens, err := s.ollamaStream(ctx, userID, systemPrompt, userMessage, w)
			if err == nil {
				s.publishEvent(userID, prompt, s.cfg.OllamaModel, "ollama", tokens)
				return nil
			}
			log.Error().Err(err).Str("user_id", userID).Msg("ai: pinned Ollama failed")
			return err
		}
		log.Warn().Str("user_id", userID).Msg("ai: ollama requested but OLLAMA_BASE_URL not set — falling through")
	case "groq":
		if s.cfg.GroqAPIKey != "" {
			log.Info().Str("user_id", userID).Str("provider", "groq").Msg("ai: pinned to Groq")
			tokens, err := s.groqStream(ctx, userID, systemPrompt, userMessage, w)
			if err == nil {
				s.publishEvent(userID, prompt, s.cfg.GroqModel, "groq", tokens)
				return nil
			}
			log.Error().Err(err).Str("user_id", userID).Msg("ai: pinned Groq failed")
			return err
		}
		log.Warn().Str("user_id", userID).Msg("ai: groq requested but key not set — falling through")
	case "github":
		if s.cfg.GitHubModelsToken != "" {
			log.Info().Str("user_id", userID).Str("provider", "github").Msg("ai: pinned to GitHub Models")
			tokens, err := s.githubModelsStream(ctx, userID, systemPrompt, userMessage, w)
			if err == nil {
				s.publishEvent(userID, prompt, s.cfg.GitHubModelsModel, "github", tokens)
				return nil
			}
			log.Error().Err(err).Str("user_id", userID).Msg("ai: pinned GitHub Models failed")
			return err
		}
		log.Warn().Str("user_id", userID).Msg("ai: github requested but token not set — falling through")
	case "openrouter":
		if s.cfg.OpenRouterAPIKey != "" {
			log.Info().Str("user_id", userID).Str("provider", "openrouter").Msg("ai: pinned to OpenRouter")
			tokens, err := s.openRouterStream(ctx, userID, systemPrompt, userMessage, w)
			if err == nil {
				s.publishEvent(userID, prompt, s.cfg.OpenRouterModel, "openrouter", tokens)
				return nil
			}
			log.Error().Err(err).Str("user_id", userID).Msg("ai: pinned OpenRouter failed")
			return err
		}
		log.Warn().Str("user_id", userID).Msg("ai: openrouter requested but key not set — falling through")
	}

	// ── Auto fallback chain: Ollama → Groq → GitHub Models → OpenRouter ──
	if s.cfg.OllamaBaseURL != "" {
		log.Info().Str("user_id", userID).Str("provider", "ollama").
			Str("model", s.cfg.OllamaModel).Str("prompt_preview", truncate(prompt, 120)).
			Msg("ai: trying Ollama")
		tokens, err := s.ollamaStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.OllamaModel, "ollama", tokens)
			return nil
		}
		log.Warn().Err(err).Str("user_id", userID).Msg("ai: Ollama failed — falling back to Groq")
	}

	if s.cfg.GroqAPIKey != "" {
		log.Info().Str("user_id", userID).Str("provider", "groq").
			Str("model", s.cfg.GroqModel).Msg("ai: trying Groq")
		tokens, err := s.groqStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.GroqModel, "groq", tokens)
			return nil
		}
		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", userID).Msg("ai: Groq quota exceeded — falling back to GitHub Models")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: Groq failed — falling back to GitHub Models")
		}
	}

	if s.cfg.GitHubModelsToken != "" {
		log.Info().Str("user_id", userID).Str("provider", "github").
			Str("model", s.cfg.GitHubModelsModel).Msg("ai: trying GitHub Models")
		tokens, err := s.githubModelsStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.GitHubModelsModel, "github", tokens)
			return nil
		}
		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", userID).Msg("ai: GitHub Models quota exceeded — falling back to OpenRouter")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: GitHub Models failed — falling back to OpenRouter")
		}
	}

	if s.cfg.OpenRouterAPIKey != "" {
		log.Info().Str("user_id", userID).Str("provider", "openrouter").
			Str("model", s.cfg.OpenRouterModel).Msg("ai: trying OpenRouter")
		tokens, err := s.openRouterStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.OpenRouterModel, "openrouter", tokens)
			return nil
		}
		log.Error().Err(err).Str("user_id", userID).Msg("ai: OpenRouter also failed")
		return err
	}

	log.Warn().Str("user_id", userID).Msg("ai: no AI provider available")
	return ErrAIUnavailable
}

// ── groqStream ────────────────────────────────────────────────────────────

func (s *AIService) groqStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	return s.openAICompatStream(ctx, userID, groqURL, s.cfg.GroqAPIKey, s.cfg.GroqModel, "groq", system, user, w)
}

// ── githubModelsStream ────────────────────────────────────────────────────

func (s *AIService) githubModelsStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	return s.openAICompatStream(ctx, userID, githubModelsURL, s.cfg.GitHubModelsToken, s.cfg.GitHubModelsModel, "github", system, user, w)
}

// ── openRouterStream ──────────────────────────────────────────────────────

func (s *AIService) openRouterStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	return s.openAICompatStream(ctx, userID, openRouterURL, s.cfg.OpenRouterAPIKey, s.cfg.OpenRouterModel, "openrouter", system, user, w)
}

// ── openAICompatStream — shared streaming logic for all OpenAI-compat APIs ─

func (s *AIService) openAICompatStream(ctx context.Context, userID, url, token, model, providerName, system, user string, w http.ResponseWriter) (int, error) {
	messages := make([]orMessage, 0, 2)
	// Empty system lets Ollama keep the Modelfile SYSTEM (few-shot architecture examples).
	if strings.TrimSpace(system) != "" {
		messages = append(messages, orMessage{Role: "system", Content: system})
	}
	messages = append(messages, orMessage{Role: "user", Content: user})

	reqBody, _ := json.Marshal(orRequest{
		Model:       model,
		Messages:    messages,
		Stream:      true,
		MaxTokens:   8000,
		Temperature: 0.15,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return 0, fmt.Errorf("build %s request: %w", providerName, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("%s http: %w", providerName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			log.Warn().Str("user_id", userID).Str("provider", providerName).
				Str("body", truncate(string(body), 300)).Msg("ai: 429 quota exceeded")
			return 0, ErrAIQuotaExceeded
		}
		log.Error().Str("user_id", userID).Str("provider", providerName).
			Int("status", resp.StatusCode).Str("body", truncate(string(body), 400)).Msg("ai: non-200")
		return 0, fmt.Errorf("%s %d: %s", providerName, resp.StatusCode, truncate(string(body), 400))
	}

	writeSSEHeaders(w)
	flusher, canFlush := w.(http.Flusher)

	var tokens int
	var fullOutput strings.Builder

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			fmt.Fprintf(w, "data: [DONE]\n\n")
			if canFlush {
				flusher.Flush()
			}
			break
		}

		var chunk orStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		for _, choice := range chunk.Choices {
			text := choice.Delta.Content
			if text == "" {
				continue
			}
			tokens++
			fullOutput.WriteString(text)
			writeSSELines(w, text)
			if canFlush {
				flusher.Flush()
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Error().Err(err).Str("user_id", userID).Str("provider", providerName).Msg("ai: scanner error")
		return tokens, err
	}

	rawOut := fullOutput.String()
	log.Info().
		Str("user_id", userID).Str("provider", providerName).Str("model", model).
		Int("tokens", tokens).Str("output_preview", truncate(rawOut, 300)).
		Bool("starts_with_flowchart", strings.HasPrefix(strings.TrimSpace(rawOut), "flowchart")).
		Bool("has_markdown_fence", strings.Contains(rawOut, "```")).
		Msg("ai: stream complete")

	if tokens == 0 {
		log.Warn().Str("user_id", userID).Str("provider", providerName).Msg("ai: returned zero tokens")
	}

	return tokens, nil
}

// ── ollamaStream ──────────────────────────────────────────────────────────

// ollamaStream uses the archly-architect Modelfile SYSTEM (do not override it).
func (s *AIService) ollamaStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	url := strings.TrimRight(s.cfg.OllamaBaseURL, "/") + "/v1/chat/completions"
	_ = system // Modelfile owns system instructions + few-shot examples
	return s.openAICompatStream(ctx, userID, url, "", s.cfg.OllamaModel, "ollama", "", user, w)
}

// ── DiagramToCode ─────────────────────────────────────────────────────────

func (s *AIService) DiagramToCode(ctx context.Context, elementsJSON string, format string) (string, error) {
	if format == "" {
		format = "docker-compose"
	}
	userPrompt := fmt.Sprintf(
		"Convert this system architecture (Excalidraw elements JSON) into a %s configuration file.\nReturn only the configuration file content, no explanation.\n\nElements:\n%s",
		format, elementsJSON,
	)

	// Try providers in order: Groq → GitHub Models → OpenRouter
	if s.cfg.GroqAPIKey != "" {
		code, err := s.openAICompatGenerate(ctx, groqURL, s.cfg.GroqAPIKey, s.cfg.GroqModel, "groq", format, userPrompt)
		if err == nil {
			return code, nil
		}
		log.Warn().Err(err).Str("format", format).Msg("ai: Groq DiagramToCode failed — trying GitHub Models")
	}
	if s.cfg.GitHubModelsToken != "" {
		code, err := s.openAICompatGenerate(ctx, githubModelsURL, s.cfg.GitHubModelsToken, s.cfg.GitHubModelsModel, "github", format, userPrompt)
		if err == nil {
			return code, nil
		}
		log.Warn().Err(err).Str("format", format).Msg("ai: GitHub Models DiagramToCode failed — trying OpenRouter")
	}
	if s.cfg.OpenRouterAPIKey != "" {
		return s.openAICompatGenerate(ctx, openRouterURL, s.cfg.OpenRouterAPIKey, s.cfg.OpenRouterModel, "openrouter", format, userPrompt)
	}

	return "", ErrAIUnavailable
}

func (s *AIService) openAICompatGenerate(ctx context.Context, url, token, model, providerName, format, userPrompt string) (string, error) {
	reqBody, _ := json.Marshal(orRequest{
		Model:       model,
		Messages:    []orMessage{{Role: "user", Content: userPrompt}},
		Stream:      false,
		MaxTokens:   4000,
		Temperature: 0.1,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrAIQuotaExceeded
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct{ Message string `json:"message"` } `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode %s response: %w", providerName, err)
	}
	if result.Error != nil {
		return "", fmt.Errorf("%s error: %s", providerName, result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("%s returned no choices", providerName)
	}

	code := result.Choices[0].Message.Content
	log.Info().Str("provider", providerName).Str("format", format).Int("output_len", len(code)).Msg("ai: DiagramToCode complete")
	return code, nil
}

// ── shared helpers ────────────────────────────────────────────────────────

func writeSSEHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
}

func writeSSELines(w http.ResponseWriter, text string) {
	for _, line := range strings.Split(text, "\n") {
		fmt.Fprintf(w, "data: %s\n", line)
	}
	fmt.Fprintf(w, "\n")
}

func (s *AIService) publishEvent(userID, prompt, model, provider string, tokens int) {
	if tokens == 0 {
		return
	}
	_ = s.producer.Publish(
		topics.AIDiagramGenerated,
		userID,
		map[string]any{
			"user_id":          userID,
			"prompt_length":    len(prompt),
			"generated_tokens": tokens,
			"model":            model,
			"provider":         provider,
		},
	)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
