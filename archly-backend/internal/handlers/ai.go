package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

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
		Prompt string `json:"prompt"`
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
		Str("remote_addr", r.RemoteAddr).
		Msg("handler: TextToDiagramStream request received")

	if err := h.svc.TextToDiagramStream(r.Context(), body.Prompt, uid, w); err != nil {
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
