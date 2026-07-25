package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/archly/api/internal/middleware"
	"github.com/archly/api/internal/services"
)

type AIHandler struct {
	svc *services.AIService
}

func NewAIHandler(svc *services.AIService) *AIHandler {
	return &AIHandler{svc: svc}
}

// POST /v1/ai/text-to-diagram/chat-streaming
// SSE endpoint — streams Mermaid syntax chunks back to the client.
func (h *AIHandler) TextToDiagramStream(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Prompt   string `json:"prompt"`
		Provider string `json:"provider"` // "ollama" | "openrouter" | "" (auto)
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.Prompt == "" {
		BadRequest(w, "prompt is required")
		return
	}

	// Extract userID from JWT context if present — anonymous requests get empty string
	userID, _ := middleware.UserIDFromCtx(r.Context())
	uid := ""
	if userID != (uuid.UUID{}) {
		uid = userID.String()
	}

	log.Info().
		Str("user_id", uid).
		Str("prompt", body.Prompt).
		Str("provider_hint", body.Provider).
		Str("remote_addr", r.RemoteAddr).
		Msg("handler: TextToDiagramStream request received")

	if err := h.svc.TextToDiagramStream(r.Context(), body.Prompt, uid, body.Provider, w); err != nil {
		if errors.Is(err, services.ErrAIUnavailable) {
			log.Warn().Str("user_id", uid).Msg("handler: AI unavailable — GEMINI_API_KEY not configured")
			Error(w, http.StatusServiceUnavailable, "AI_UNAVAILABLE",
				"AI features require OPENAI_API_KEY to be configured")
			return
		}
		if errors.Is(err, services.ErrAIQuotaExceeded) {
			log.Warn().Str("user_id", uid).Msg("handler: Gemini quota exceeded")
			Error(w, http.StatusTooManyRequests, "QUOTA_EXCEEDED",
				"AI quota exceeded — free tier limit reached. Please try again later or upgrade your Gemini API plan.")
			return
		}
		// At this point we may have already written SSE headers — just log
		log.Error().Err(err).Str("user_id", uid).Msg("handler: TextToDiagramStream error after streaming started")
		return
	}
}

// POST /v1/ai/canvas-chat
// SSE endpoint — streams token events + optional actions for chaos mutations.
func (h *AIHandler) CanvasChat(w http.ResponseWriter, r *http.Request) {
	var body services.CanvasChatRequest
	if !Decode(w, r, &body) {
		return
	}
	if len(body.Messages) == 0 {
		BadRequest(w, "messages is required")
		return
	}
	last := body.Messages[len(body.Messages)-1]
	if last.Role != "user" || strings.TrimSpace(last.Content) == "" {
		BadRequest(w, "last message must be a non-empty user message")
		return
	}

	userID, _ := middleware.UserIDFromCtx(r.Context())
	uid := ""
	if userID != (uuid.UUID{}) {
		uid = userID.String()
	}

	log.Info().
		Str("user_id", uid).
		Str("canvas", body.Canvas).
		Int("nodes", len(body.Diagram.Nodes)).
		Int("messages", len(body.Messages)).
		Str("prompt", truncateStr(last.Content, 120)).
		Msg("handler: CanvasChat request received")

	if err := h.svc.CanvasChatStream(r.Context(), body, uid, w); err != nil {
		if errors.Is(err, services.ErrAIUnavailable) {
			Error(w, http.StatusServiceUnavailable, "AI_UNAVAILABLE",
				"AI features require an API key to be configured")
			return
		}
		if errors.Is(err, services.ErrAIQuotaExceeded) {
			Error(w, http.StatusTooManyRequests, "QUOTA_EXCEEDED",
				"AI quota exceeded — free tier limit reached. Please try again later.")
			return
		}
		log.Error().Err(err).Str("user_id", uid).Msg("handler: CanvasChat error")
		// Headers may already be committed for SSE — only write JSON if not.
		if w.Header().Get("Content-Type") == "" {
			InternalError(w, err)
		}
		return
	}
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// POST /v1/ai/diagram-to-code/generate
func (h *AIHandler) DiagramToCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Elements json.RawMessage `json:"elements"`
		Format   string          `json:"format"` // "terraform" | "docker-compose" | "kubernetes"
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.Elements == nil {
		BadRequest(w, "elements is required")
		return
	}

	log.Info().
		Str("format", body.Format).
		Str("remote_addr", r.RemoteAddr).
		Msg("handler: DiagramToCode request received")

	code, err := h.svc.DiagramToCode(r.Context(), string(body.Elements), body.Format)
	if err != nil {
		if errors.Is(err, services.ErrAIUnavailable) {
			log.Warn().Msg("handler: AI unavailable for DiagramToCode")
			Error(w, http.StatusServiceUnavailable, "AI_UNAVAILABLE",
				"AI features require OPENAI_API_KEY to be configured")
			return
		}
		log.Error().Err(err).Str("format", body.Format).Msg("handler: DiagramToCode error")
		InternalError(w, err)
		return
	}

	JSON(w, http.StatusOK, map[string]string{
		"code":   code,
		"format": body.Format,
	})
}
