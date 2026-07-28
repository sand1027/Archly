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
	nvidiaURL       = "https://integrate.api.nvidia.com/v1/chat/completions"
)

// AIService manages all AI provider calls.
type AIService struct {
	cfg      *config.Config
	client   *http.Client
	producer kafka.Producer
}

func NewAIService(cfg *config.Config, producer kafka.Producer) *AIService {
	return &AIService{
		cfg: cfg,
		client: &http.Client{
			// Full stream can take minutes for large Mermaid; fail fast if headers never arrive.
			Timeout: 8 * time.Minute,
			Transport: &http.Transport{
				Proxy:                 http.ProxyFromEnvironment,
				ResponseHeaderTimeout: 45 * time.Second,
				IdleConnTimeout:       90 * time.Second,
				TLSHandshakeTimeout:   15 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
			},
		},
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
	Error *struct {
		Message string `json:"message"`
		Code    any    `json:"code"`
	} `json:"error"`
	Choices []struct {
		Delta struct {
			Content          string `json:"content"`
			Reasoning        string `json:"reasoning"`
			ReasoningContent string `json:"reasoning_content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

// deltaVisibleText returns assistant-visible text from a stream delta.
// Prefer content; some free/thinking models only emit reasoning — use that
// only when it already looks like Mermaid (otherwise it pollutes the diagram).
func deltaVisibleText(content, reasoning, reasoningContent string) string {
	if strings.TrimSpace(content) != "" {
		return content
	}
	r := reasoning
	if strings.TrimSpace(r) == "" {
		r = reasoningContent
	}
	trim := strings.TrimSpace(r)
	if strings.HasPrefix(trim, "flowchart") ||
		strings.HasPrefix(trim, "graph ") ||
		strings.HasPrefix(trim, "erDiagram") {
		return r
	}
	return ""
}

// openRouterModelCandidates tries the configured model first, then known-good free fallbacks.
// Free OpenRouter models rotate and frequently return empty / 429.
func openRouterModelCandidates(primary string) []string {
	fallbacks := []string{
		"arcee-ai/trinity-large-preview:free",
		"qwen/qwen3-8b:free",
		"google/gemma-3-27b-it:free",
		"meta-llama/llama-3.3-70b-instruct:free",
		"mistralai/mistral-small-3.1-24b-instruct:free",
	}
	out := make([]string, 0, 1+len(fallbacks))
	seen := map[string]bool{}
	add := func(m string) {
		m = strings.TrimSpace(m)
		if m == "" || seen[m] {
			return
		}
		seen[m] = true
		out = append(out, m)
	}
	add(primary)
	for _, m := range fallbacks {
		add(m)
	}
	return out
}

func setOpenAICompatHeaders(req *http.Request, token, providerName string) {
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	// OpenRouter ranks / routes better with these; some free endpoints require them.
	if providerName == "openrouter" {
		req.Header.Set("HTTP-Referer", "https://archly.dev")
		req.Header.Set("X-Title", "Archly")
	}
}

func maxTokensForProvider(providerName, model string) int {
	if strings.HasPrefix(providerName, "nvidia") {
		return 4096
	}
	// Free OpenRouter models often fail or stall with huge max_tokens.
	if providerName == "openrouter" && strings.Contains(model, ":free") {
		return 4096
	}
	if providerName == "openrouter" {
		return 8000
	}
	return 12000
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

// schemaSystemPrompt — used for cloud providers (no Modelfile).
// Ollama schema mode uses archly-schema Modelfile SYSTEM instead (empty override).
// Mirrors diagramSystemPrompt structure for relational ERDs.
const schemaSystemPrompt = `You are an expert database schema designer. Output ONLY Mermaid erDiagram syntax for a production RELATIONAL DATA MODEL.

STRICT RULES:
- Start with exactly: erDiagram
- No prose, markdown fences, comments, flowchart, graph, or subgraph blocks
- This is a RELATIONAL DATA MODEL (tables, columns, PKs, FKs) — NEVER infrastructure architecture
- Target EXACTLY 30–40 tables and 35–55 relationships — denser than a normal demo ERD
- Do NOT emit a small/toy schema (under 30 tables is a failure)
- Be DETAILED: each table should have 5–12 columns (PK, FKs, domain fields, created_at/updated_at, deleted_at when relevant)
- Include: auth/sessions/roles, core domain, join/bridge tables, media/files if relevant, notifications, billing/subscriptions/payments if relevant, audit_logs
- Emit ALL relationship lines FIRST with short labels, THEN full attribute blocks for every entity
- Put spaces around ops: Users ||--o{ Sessions : has
- Entity names: single CamelCase or snake_case tokens only — never spaces
- Column names UNIQUE within each table (never duplicate id)
- Every relationship MUST appear as a line AND as an FK column on the child table
- Use cardinality: ||--|| (1:1), ||--o{ (1:N), }o--o{ (N:M)
- Attribute lines: type name PK|FK|UK — prefer uuid, text, int, bigint, boolean, timestamptz, jsonb, numeric
- Never stop early`

func schemaUserPrompt(prompt string) string {
	return fmt.Sprintf(
		`Design the production database schema for: %s

Interpret product names (e.g. Unacademy, Uber, Stripe, Twitter, Zoho) as the real platform's data model — NOT a UI flow or architecture diagram.

Requirements:
- 30–40 tables, each with rich columns (5–12 fields: PK/FK/UK + domain + timestamps)
- 35–55 relationships with short labels
- Cover auth, core domain, join tables, notifications, billing if relevant, audit_logs
- Relationship lines first, then every entity attribute block
- Entity names: no spaces. Column names unique per table
- Do NOT ask for a table list. Do NOT output a small 10–15 table sketch

Output ONLY Mermaid starting with "erDiagram". Never stop early. No other text.`,
		prompt,
	)
}

// ── TextToDiagramStream ───────────────────────────────────────────────────

// nvidiaModel resolves which NIM model id to use for a pinned NVIDIA provider.
func (s *AIService) nvidiaModel(provider string) string {
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case "nvidia-nemotron":
		if m := strings.TrimSpace(s.cfg.NvidiaNemotronModel); m != "" {
			return m
		}
		return "nvidia/llama-3.3-nemotron-super-49b-v1.5"
	case "nvidia-deepseek":
		if m := strings.TrimSpace(s.cfg.NvidiaDeepSeekModel); m != "" {
			return m
		}
		return "deepseek-ai/deepseek-v4-pro"
	default:
		if m := strings.TrimSpace(s.cfg.NvidiaModel); m != "" {
			return m
		}
		return "meta/llama-3.3-70b-instruct"
	}
}

// TextToDiagramStream streams Mermaid syntax to w.
// mode: "architecture" (default flowchart) | "schema" (erDiagram)
// Chain: Ollama → Groq → NVIDIA → GitHub Models → OpenRouter
// If provider is set, skips straight to that provider.
func (s *AIService) TextToDiagramStream(ctx context.Context, prompt, userID, provider, mode string, w http.ResponseWriter) error {
	isSchema := strings.EqualFold(strings.TrimSpace(mode), "schema")
	systemPrompt := diagramSystemPrompt
	userMessage := diagramUserPrompt(prompt)
	// Ollama: empty system keeps the matching Modelfile SYSTEM (few-shots).
	// Architecture → archly-architect; Schema → archly-schema.
	ollamaSystem := ""
	ollamaModel := s.cfg.OllamaModel
	if isSchema {
		systemPrompt = schemaSystemPrompt
		userMessage = schemaUserPrompt(prompt)
		ollamaModel = s.cfg.OllamaSchemaModel
		if strings.TrimSpace(ollamaModel) == "" {
			ollamaModel = "archly-schema"
		}
	}

	// ── Provider pinning ─────────────────────────────────────────────────
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case "ollama":
		if s.cfg.OllamaBaseURL != "" {
			log.Info().Str("user_id", userID).Str("provider", "ollama").Str("mode", mode).Str("model", ollamaModel).Msg("ai: pinned to Ollama")
			tokens, err := s.ollamaStream(ctx, userID, ollamaSystem, userMessage, ollamaModel, w)
			if err == nil {
				s.publishEvent(userID, prompt, ollamaModel, "ollama", tokens)
				return nil
			}
			// Empty/failed Ollama (common when Modelfile stops fire) → try cloud providers.
			log.Warn().Err(err).Str("user_id", userID).Str("model", ollamaModel).
				Msg("ai: pinned Ollama failed — falling through to cloud")
		} else {
			log.Warn().Str("user_id", userID).Msg("ai: ollama requested but OLLAMA_BASE_URL not set — falling through")
		}
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
			// Empty free-model responses are common — fall through to Groq/GitHub like Ollama.
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: pinned OpenRouter failed — falling through to other providers")
		} else {
			log.Warn().Str("user_id", userID).Msg("ai: openrouter requested but key not set — falling through")
		}
	case "nvidia", "nvidia-nemotron", "nvidia-deepseek":
		if s.cfg.NvidiaAPIKey == "" {
			log.Warn().Str("user_id", userID).Msg("ai: nvidia requested but NVIDIA_API_KEY not set")
			return ErrAIUnavailable
		}
		model := s.nvidiaModel(provider)
		log.Info().Str("user_id", userID).Str("provider", provider).Str("model", model).Msg("ai: pinned to NVIDIA NIM")
		tokens, err := s.nvidiaStream(ctx, userID, systemPrompt, userMessage, model, provider, w)
		if err == nil {
			s.publishEvent(userID, prompt, model, provider, tokens)
			return nil
		}
		log.Error().Err(err).Str("user_id", userID).Str("provider", provider).Str("model", model).
			Msg("ai: pinned NVIDIA failed")
		return err
	}

	// ── Auto fallback chain: Ollama → Groq → NVIDIA → GitHub Models → OpenRouter ──
	if s.cfg.OllamaBaseURL != "" {
		log.Info().Str("user_id", userID).Str("provider", "ollama").
			Str("model", ollamaModel).Str("mode", mode).Str("prompt_preview", truncate(prompt, 120)).
			Msg("ai: trying Ollama")
		tokens, err := s.ollamaStream(ctx, userID, ollamaSystem, userMessage, ollamaModel, w)
		if err == nil {
			s.publishEvent(userID, prompt, ollamaModel, "ollama", tokens)
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
			log.Warn().Str("user_id", userID).Msg("ai: Groq quota exceeded — falling back to next provider")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: Groq failed — falling back to next provider")
		}
	}

	if s.cfg.NvidiaAPIKey != "" {
		model := s.nvidiaModel("nvidia")
		log.Info().Str("user_id", userID).Str("provider", "nvidia").
			Str("model", model).Msg("ai: trying NVIDIA NIM")
		tokens, err := s.nvidiaStream(ctx, userID, systemPrompt, userMessage, model, "nvidia", w)
		if err == nil {
			s.publishEvent(userID, prompt, model, "nvidia", tokens)
			return nil
		}
		if errors.Is(err, ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", userID).Msg("ai: NVIDIA quota exceeded — falling back to GitHub Models")
		} else {
			log.Warn().Err(err).Str("user_id", userID).Msg("ai: NVIDIA failed/timed out — falling back to GitHub Models")
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
	var lastErr error
	for _, model := range openRouterModelCandidates(s.cfg.OpenRouterModel) {
		log.Info().Str("user_id", userID).Str("provider", "openrouter").Str("model", model).Msg("ai: trying OpenRouter model")
		tokens, err := s.openAICompatStream(ctx, userID, openRouterURL, s.cfg.OpenRouterAPIKey, model, "openrouter", system, user, w)
		if err == nil {
			return tokens, nil
		}
		lastErr = err
		// Safe to retry: empty responses never started SSE on the client.
		log.Warn().Err(err).Str("user_id", userID).Str("model", model).Msg("ai: OpenRouter model failed — trying next")
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("openrouter: no models available")
	}
	return 0, lastErr
}

// ── nvidiaStream ──────────────────────────────────────────────────────────

func (s *AIService) nvidiaStream(ctx context.Context, userID, system, user, model, providerName string, w http.ResponseWriter) (int, error) {
	return s.openAICompatStream(ctx, userID, nvidiaURL, s.cfg.NvidiaAPIKey, model, providerName, system, user, w)
}

// ── openAICompatStream — shared streaming logic for all OpenAI-compat APIs ─

func (s *AIService) openAICompatStream(ctx context.Context, userID, url, token, model, providerName, system, user string, w http.ResponseWriter) (int, error) {
	messages := make([]orMessage, 0, 2)
	// Empty system lets Ollama keep the Modelfile SYSTEM (few-shot architecture examples).
	if strings.TrimSpace(system) != "" {
		messages = append(messages, orMessage{Role: "system", Content: system})
	}
	messages = append(messages, orMessage{Role: "user", Content: user})

	// NVIDIA hosted NIM commonly caps max_tokens around 4k for Llama-class models.
	// Free OpenRouter models often return empty / stall with huge max_tokens.
	maxTokens := maxTokensForProvider(providerName, model)

	reqBody, _ := json.Marshal(orRequest{
		Model:       model,
		Messages:    messages,
		Stream:      true,
		MaxTokens:   maxTokens,
		Temperature: 0.15,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return 0, fmt.Errorf("build %s request: %w", providerName, err)
	}
	setOpenAICompatHeaders(req, token, providerName)

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

	flusher, canFlush := w.(http.Flusher)

	var tokens int
	var fullOutput strings.Builder
	sseStarted := false

	startSSE := func() {
		if sseStarted {
			return
		}
		writeSSEHeaders(w)
		sseStarted = true
	}

	scanner := bufio.NewScanner(resp.Body)
	// Large Mermaid diagrams can produce long SSE lines.
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			if sseStarted {
				fmt.Fprintf(w, "data: [DONE]\n\n")
				if canFlush {
					flusher.Flush()
				}
			}
			break
		}

		var chunk orStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if chunk.Error != nil && strings.TrimSpace(chunk.Error.Message) != "" {
			return tokens, fmt.Errorf("%s stream error: %s", providerName, chunk.Error.Message)
		}

		for _, choice := range chunk.Choices {
			text := deltaVisibleText(
				choice.Delta.Content,
				choice.Delta.Reasoning,
				choice.Delta.ReasoningContent,
			)
			if text == "" {
				continue
			}
			startSSE()
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
		Bool("starts_with_erdiagram", strings.HasPrefix(strings.TrimSpace(rawOut), "erDiagram")).
		Bool("has_markdown_fence", strings.Contains(rawOut, "```")).
		Msg("ai: stream complete")

	if tokens == 0 || strings.TrimSpace(rawOut) == "" {
		log.Warn().Str("user_id", userID).Str("provider", providerName).Str("model", model).
			Msg("ai: returned zero tokens / empty output")
		return 0, fmt.Errorf("%s returned empty output for model %s", providerName, model)
	}

	return tokens, nil
}

// ── ollamaStream ──────────────────────────────────────────────────────────

// ollamaStream calls a local Ollama model.
// Empty system → keep Modelfile SYSTEM (few-shots).
// Pass archly-architect for architecture, archly-schema for ERD.
func (s *AIService) ollamaStream(ctx context.Context, userID, system, user, model string, w http.ResponseWriter) (int, error) {
	url := strings.TrimRight(s.cfg.OllamaBaseURL, "/") + "/v1/chat/completions"
	if strings.TrimSpace(model) == "" {
		model = s.cfg.OllamaModel
	}
	return s.openAICompatStream(ctx, userID, url, "", model, "ollama", system, user, w)
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
		var lastErr error
		for _, model := range openRouterModelCandidates(s.cfg.OpenRouterModel) {
			code, err := s.openAICompatGenerate(ctx, openRouterURL, s.cfg.OpenRouterAPIKey, model, "openrouter", format, userPrompt)
			if err == nil && strings.TrimSpace(code) != "" {
				return code, nil
			}
			lastErr = err
			if err == nil {
				lastErr = fmt.Errorf("openrouter returned empty code for model %s", model)
			}
			log.Warn().Err(lastErr).Str("model", model).Msg("ai: OpenRouter DiagramToCode model failed — trying next")
		}
		if lastErr != nil {
			return "", lastErr
		}
	}

	return "", ErrAIUnavailable
}

func (s *AIService) openAICompatGenerate(ctx context.Context, url, token, model, providerName, format, userPrompt string) (string, error) {
	reqBody, _ := json.Marshal(orRequest{
		Model:       model,
		Messages:    []orMessage{{Role: "user", Content: userPrompt}},
		Stream:      false,
		MaxTokens:   maxTokensForProvider(providerName, model),
		Temperature: 0.1,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	setOpenAICompatHeaders(req, token, providerName)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrAIQuotaExceeded
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("%s %d: %s", providerName, resp.StatusCode, truncate(string(body), 400))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content          string `json:"content"`
				Reasoning        string `json:"reasoning"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
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

	msg := result.Choices[0].Message
	code := deltaVisibleText(msg.Content, msg.Reasoning, msg.ReasoningContent)
	if strings.TrimSpace(code) == "" {
		code = msg.Content
	}
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
