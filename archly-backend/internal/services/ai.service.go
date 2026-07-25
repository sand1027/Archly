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

// geminiErrorBody parses non-200 error responses from Gemini.
type geminiErrorBody struct {
	Error struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
		Details []struct {
			Type       string `json:"@type"`
			RetryDelay string `json:"retryDelay,omitempty"`
		} `json:"details"`
	} `json:"error"`
}

// Endpoints
const (
	geminiBaseURL    = "https://generativelanguage.googleapis.com/v1beta/models"
	openRouterURL    = "https://openrouter.ai/api/v1/chat/completions"
)

// AIService proxies requests to Gemini (primary) or OpenRouter (fallback).
type AIService struct {
	cfg      *config.Config
	client   *http.Client
	producer kafka.Producer
}

func NewAIService(cfg *config.Config, producer kafka.Producer) *AIService {
	return &AIService{
		cfg:      cfg,
		client:   &http.Client{Timeout: 120 * time.Second},
		producer: producer,
	}
}

// ── Gemini shapes ─────────────────────────────────────────────────────────

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiRequest struct {
	Contents          []geminiContent        `json:"contents"`
	SystemInstruction *geminiContent         `json:"systemInstruction,omitempty"`
	GenerationConfig  map[string]interface{} `json:"generationConfig,omitempty"`
}

type geminiStreamChunk struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text             string `json:"text"`
				ThoughtSignature string `json:"thoughtSignature,omitempty"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
}

// ── OpenRouter (OpenAI-compatible) shapes ─────────────────────────────────

type orMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type orRequest struct {
	Model    string      `json:"model"`
	Messages []orMessage `json:"messages"`
	Stream   bool        `json:"stream"`
	MaxTokens int        `json:"max_tokens,omitempty"`
	Temperature float64  `json:"temperature,omitempty"`
}

type orStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

// ── TextToDiagramStream ───────────────────────────────────────────────────

// TextToDiagramStream tries Ollama first (if configured); falls back to
// Gemini, then OpenRouter. If provider is set, skips straight to that provider.
// Streams SSE directly to w.
func (s *AIService) TextToDiagramStream(ctx context.Context, prompt, userID, provider string, w http.ResponseWriter) error {
	systemPrompt := `You output only Mermaid flowchart syntax. Nothing else. No prose, no explanation, no comments, no markdown fences. Start immediately with "flowchart TD". Do NOT use subgraph blocks.`
	userMessage := fmt.Sprintf(
		"Generate a Mermaid flowchart diagram for: %s\n\nOutput ONLY the Mermaid syntax starting with \"flowchart TD\". No subgraph blocks. No other text.",
		prompt,
	)

	// ── Provider pinning — skip straight to requested provider ────────────
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
	case "gemini":
		if s.cfg.GeminiAPIKey != "" {
			log.Info().Str("user_id", userID).Str("provider", "gemini").Msg("ai: pinned to Gemini")
			tokens, err := s.geminiStream(ctx, userID, systemPrompt, userMessage, w)
			if err == nil {
				s.publishEvent(userID, prompt, s.cfg.GeminiModel, "gemini", tokens)
				return nil
			}
			log.Error().Err(err).Str("user_id", userID).Msg("ai: pinned Gemini failed")
			return err
		}
		log.Warn().Str("user_id", userID).Msg("ai: gemini requested but key not set — falling through")
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

	// ── Auto fallback chain: Ollama → Gemini → OpenRouter ─────────────────
	if s.cfg.OllamaBaseURL != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "ollama").
			Str("model", s.cfg.OllamaModel).
			Str("prompt_preview", truncate(prompt, 120)).
			Msg("ai: TextToDiagramStream — trying Ollama")

		tokens, err := s.ollamaStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.OllamaModel, "ollama", tokens)
			return nil
		}

		log.Warn().Err(err).Str("user_id", userID).Msg("ai: Ollama failed — falling back to Gemini")
	} else {
		log.Info().Str("user_id", userID).Msg("ai: OLLAMA_BASE_URL not set — trying Gemini directly")
	}

	// ── Fallback: Gemini ──────────────────────────────────────────────────
	if s.cfg.GeminiAPIKey != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "gemini").
			Str("model", s.cfg.GeminiModel).
			Msg("ai: TextToDiagramStream — trying Gemini")

		tokens, err := s.geminiStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.GeminiModel, "gemini", tokens)
			return nil
		}

		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", userID).Msg("ai: Gemini quota exceeded — falling back to OpenRouter")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: Gemini failed — falling back to OpenRouter")
		}
	}

	// ── Fallback: OpenRouter ──────────────────────────────────────────────
	if s.cfg.OpenRouterAPIKey != "" {
		log.Info().
			Str("user_id", userID).
			Str("provider", "openrouter").
			Str("model", s.cfg.OpenRouterModel).
			Msg("ai: TextToDiagramStream — trying OpenRouter")

		tokens, err := s.openRouterStream(ctx, userID, systemPrompt, userMessage, w)
		if err == nil {
			s.publishEvent(userID, prompt, s.cfg.OpenRouterModel, "openrouter", tokens)
			return nil
		}

		log.Error().Err(err).Str("user_id", userID).Msg("ai: OpenRouter also failed")
		return err
	}

	log.Warn().Str("user_id", userID).Msg("ai: no AI provider available — Ollama, Gemini and OpenRouter all unconfigured")
	return ErrAIUnavailable
}

// ── geminiStream ──────────────────────────────────────────────────────────

// geminiStream calls Gemini's streamGenerateContent endpoint and writes SSE
// to w. Returns (tokensStreamed, error). On quota/rate-limit returns
// ErrAIQuotaExceeded without writing any headers so the caller can fall back.
func (s *AIService) geminiStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	reqBody, _ := json.Marshal(geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: system}},
		},
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: user}}},
		},
		GenerationConfig: map[string]interface{}{
			"maxOutputTokens": 2000,
			"temperature":     0.1,
		},
	})

	url := fmt.Sprintf("%s/%s:streamGenerateContent?alt=sse&key=%s",
		geminiBaseURL, s.cfg.GeminiModel, s.cfg.GeminiAPIKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return 0, fmt.Errorf("build gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("gemini http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		var gemErr geminiErrorBody
		retryDelay := ""
		if json.Unmarshal(body, &gemErr) == nil {
			for _, d := range gemErr.Error.Details {
				if d.RetryDelay != "" {
					retryDelay = d.RetryDelay
				}
			}
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			log.Warn().
				Str("user_id", userID).
				Str("retry_delay", retryDelay).
				Str("message", truncate(gemErr.Error.Message, 200)).
				Msg("ai: Gemini 429 quota exceeded")
			return 0, ErrAIQuotaExceeded
		}
		log.Error().
			Str("user_id", userID).
			Int("status", resp.StatusCode).
			Str("body", truncate(string(body), 400)).
			Msg("ai: Gemini non-200")
		return 0, fmt.Errorf("gemini %d: %s", resp.StatusCode, truncate(string(body), 400))
	}

	// Headers committed here — no turning back after this point
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
			break
		}

		var chunk geminiStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			log.Warn().Str("user_id", userID).Str("raw", truncate(data, 200)).Err(err).
				Msg("ai: gemini chunk unmarshal failed — skipping")
			continue
		}

		for _, candidate := range chunk.Candidates {
			for _, part := range candidate.Content.Parts {
				if part.ThoughtSignature != "" || part.Text == "" {
					continue
				}
				tokens++
				fullOutput.WriteString(part.Text)
				writeSSELines(w, part.Text)
				if canFlush {
					flusher.Flush()
				}
			}
			if candidate.FinishReason == "STOP" || candidate.FinishReason == "MAX_TOKENS" {
				log.Debug().Str("user_id", userID).Str("finish_reason", candidate.FinishReason).
					Int("tokens", tokens).Msg("ai: Gemini stream finished")
				fmt.Fprintf(w, "data: [DONE]\n\n")
				if canFlush {
					flusher.Flush()
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("ai: Gemini scanner error")
		return tokens, err
	}

	rawOut := fullOutput.String()
	log.Info().
		Str("user_id", userID).
		Str("model", s.cfg.GeminiModel).
		Int("tokens", tokens).
		Str("output_preview", truncate(rawOut, 300)).
		Bool("starts_with_flowchart", strings.HasPrefix(strings.TrimSpace(rawOut), "flowchart")).
		Bool("has_markdown_fence", strings.Contains(rawOut, "```")).
		Bool("has_subgraph", strings.Contains(strings.ToLower(rawOut), "subgraph")).
		Msg("ai: geminiStream complete")

	if tokens == 0 {
		log.Warn().Str("user_id", userID).Msg("ai: Gemini returned zero tokens")
	}

	return tokens, nil
}

// ── openRouterStream ──────────────────────────────────────────────────────

// openRouterStream calls OpenRouter's OpenAI-compatible streaming endpoint
// and writes SSE to w. Returns (tokensStreamed, error).
func (s *AIService) openRouterStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	reqBody, _ := json.Marshal(orRequest{
		Model: s.cfg.OpenRouterModel,
		Messages: []orMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Stream:      true,
		MaxTokens:   2000,
		Temperature: 0.1,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterURL, bytes.NewReader(reqBody))
	if err != nil {
		return 0, fmt.Errorf("build openrouter request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.OpenRouterAPIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("openrouter http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			log.Warn().Str("user_id", userID).Str("body", truncate(string(body), 300)).
				Msg("ai: OpenRouter 429 quota exceeded")
			return 0, ErrAIQuotaExceeded
		}
		log.Error().Str("user_id", userID).Int("status", resp.StatusCode).
			Str("body", truncate(string(body), 400)).Msg("ai: OpenRouter non-200")
		return 0, fmt.Errorf("openrouter %d: %s", resp.StatusCode, truncate(string(body), 400))
	}

	// Headers committed here
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
			log.Warn().Str("user_id", userID).Str("raw", truncate(data, 200)).Err(err).
				Msg("ai: openrouter chunk unmarshal failed — skipping")
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
			if choice.FinishReason != nil && *choice.FinishReason != "" {
				log.Debug().Str("user_id", userID).Str("finish_reason", *choice.FinishReason).
					Int("tokens", tokens).Msg("ai: OpenRouter stream finished")
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("ai: OpenRouter scanner error")
		return tokens, err
	}

	rawOut := fullOutput.String()
	log.Info().
		Str("user_id", userID).
		Str("model", s.cfg.OpenRouterModel).
		Int("tokens", tokens).
		Str("output_preview", truncate(rawOut, 300)).
		Bool("starts_with_flowchart", strings.HasPrefix(strings.TrimSpace(rawOut), "flowchart")).
		Bool("has_markdown_fence", strings.Contains(rawOut, "```")).
		Bool("has_subgraph", strings.Contains(strings.ToLower(rawOut), "subgraph")).
		Msg("ai: openRouterStream complete")

	if tokens == 0 {
		log.Warn().Str("user_id", userID).Msg("ai: OpenRouter returned zero tokens")
	}

	return tokens, nil
}

// ── ollamaStream ──────────────────────────────────────────────────────────

// ollamaStream calls a local Ollama instance (OpenAI-compatible) and streams
// SSE to w. No API key needed — uses OLLAMA_BASE_URL env var.
func (s *AIService) ollamaStream(ctx context.Context, userID, system, user string, w http.ResponseWriter) (int, error) {
	url := strings.TrimRight(s.cfg.OllamaBaseURL, "/") + "/v1/chat/completions"

	reqBody, _ := json.Marshal(orRequest{
		Model: s.cfg.OllamaModel,
		Messages: []orMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Stream:      true,
		MaxTokens:   2000,
		Temperature: 0.1,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return 0, fmt.Errorf("build ollama request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("ollama http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Error().Str("user_id", userID).Int("status", resp.StatusCode).
			Str("body", truncate(string(body), 400)).Msg("ai: Ollama non-200")
		return 0, fmt.Errorf("ollama %d: %s", resp.StatusCode, truncate(string(body), 400))
	}

	// Headers committed here
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
		log.Error().Err(err).Str("user_id", userID).Msg("ai: Ollama scanner error")
		return tokens, err
	}

	rawOut := fullOutput.String()
	log.Info().
		Str("user_id", userID).
		Str("model", s.cfg.OllamaModel).
		Int("tokens", tokens).
		Str("output_preview", truncate(rawOut, 300)).
		Bool("starts_with_flowchart", strings.HasPrefix(strings.TrimSpace(rawOut), "flowchart")).
		Bool("has_markdown_fence", strings.Contains(rawOut, "```")).
		Msg("ai: ollamaStream complete")

	return tokens, nil
}

// DiagramToCode converts Excalidraw JSON to infra code via Gemini (primary)
// or OpenRouter (fallback).
func (s *AIService) DiagramToCode(ctx context.Context, elementsJSON string, format string) (string, error) {
	if format == "" {
		format = "docker-compose"
	}

	userPrompt := fmt.Sprintf(
		"Convert this system architecture (Excalidraw elements JSON) into a %s configuration file.\nReturn only the configuration file content, no explanation.\n\nElements:\n%s",
		format, elementsJSON,
	)

	// Try Gemini first
	if s.cfg.GeminiAPIKey != "" {
		log.Info().Str("format", format).Str("provider", "gemini").Str("model", s.cfg.GeminiModel).
			Msg("ai: DiagramToCode — trying Gemini")
		code, err := s.geminiGenerate(ctx, format, userPrompt)
		if err == nil {
			return code, nil
		}
		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("format", format).Msg("ai: Gemini quota exceeded for DiagramToCode — falling back to OpenRouter")
		} else {
			log.Warn().Err(err).Str("format", format).Msg("ai: Gemini DiagramToCode failed — falling back to OpenRouter")
		}
	}

	// Fallback: OpenRouter
	if s.cfg.OpenRouterAPIKey != "" {
		log.Info().Str("format", format).Str("provider", "openrouter").Str("model", s.cfg.OpenRouterModel).
			Msg("ai: DiagramToCode — trying OpenRouter")
		return s.openRouterGenerate(ctx, format, userPrompt)
	}

	log.Warn().Str("format", format).Msg("ai: no AI provider configured for DiagramToCode")
	return "", ErrAIUnavailable
}

// geminiGenerate calls the non-streaming Gemini generateContent endpoint.
func (s *AIService) geminiGenerate(ctx context.Context, format, userPrompt string) (string, error) {
	reqBody, _ := json.Marshal(geminiRequest{
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: userPrompt}}},
		},
		GenerationConfig: map[string]interface{}{
			"maxOutputTokens": 2000,
			"temperature":     0.1,
		},
	})

	url := fmt.Sprintf("%s/%s:generateContent?key=%s", geminiBaseURL, s.cfg.GeminiModel, s.cfg.GeminiAPIKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrAIQuotaExceeded
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct{ Text string `json:"text"` } `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Error *struct{ Message string `json:"message"` } `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode gemini response: %w", err)
	}
	if result.Error != nil {
		log.Error().Str("format", format).Str("gemini_error", result.Error.Message).Msg("ai: Gemini DiagramToCode error")
		return "", fmt.Errorf("gemini error: %s", result.Error.Message)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		log.Warn().Str("format", format).Msg("ai: Gemini returned no candidates for DiagramToCode")
		return "", errors.New("no content in Gemini response")
	}

	code := result.Candidates[0].Content.Parts[0].Text
	log.Info().Str("format", format).Int("output_len", len(code)).Msg("ai: geminiGenerate complete")
	return code, nil
}

// openRouterGenerate calls OpenRouter's non-streaming chat completions endpoint.
func (s *AIService) openRouterGenerate(ctx context.Context, format, userPrompt string) (string, error) {
	reqBody, _ := json.Marshal(orRequest{
		Model:       s.cfg.OpenRouterModel,
		Messages:    []orMessage{{Role: "user", Content: userPrompt}},
		Stream:      false,
		MaxTokens:   2000,
		Temperature: 0.1,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.OpenRouterAPIKey)

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
		return "", fmt.Errorf("decode openrouter response: %w", err)
	}
	if result.Error != nil {
		log.Error().Str("format", format).Str("or_error", result.Error.Message).Msg("ai: OpenRouter DiagramToCode error")
		return "", fmt.Errorf("openrouter error: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		log.Warn().Str("format", format).Msg("ai: OpenRouter returned no choices for DiagramToCode")
		return "", errors.New("no content in OpenRouter response")
	}

	code := result.Choices[0].Message.Content
	log.Info().Str("format", format).Int("output_len", len(code)).Msg("ai: openRouterGenerate complete")
	return code, nil
}

// ── shared helpers ────────────────────────────────────────────────────────

// writeSSEHeaders sets the required SSE response headers.
func writeSSEHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
}

// writeSSELines splits text on newlines and writes each as a separate SSE data line.
func writeSSELines(w http.ResponseWriter, text string) {
	for _, line := range strings.Split(text, "\n") {
		fmt.Fprintf(w, "data: %s\n", line)
	}
	fmt.Fprintf(w, "\n")
}

// publishEvent fires a Kafka event after a successful generation.
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

// truncate returns up to n characters of s, appending "…" if cut.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
