package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/archly/api/internal/middleware"
	"github.com/archly/api/internal/services"
)

type ShareHandler struct {
	svc *services.ShareService
}

func NewShareHandler(svc *services.ShareService) *ShareHandler {
	return &ShareHandler{svc: svc}
}

// POST /share
func (h *ShareHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	var body struct {
		DesignID string          `json:"design_id"`
		Elements json.RawMessage `json:"elements"`
		AppState json.RawMessage `json:"app_state"`
		TTLHours int             `json:"ttl_hours"`
	}
	if !Decode(w, r, &body) {
		return
	}

	var designID *uuid.UUID
	if body.DesignID != "" {
		id, err := uuid.Parse(body.DesignID)
		if err != nil {
			BadRequest(w, "invalid design_id")
			return
		}
		designID = &id
	}

	result, err := h.svc.Create(r.Context(), userID, designID, body.Elements, body.AppState, body.TTLHours)
	if err != nil {
		InternalError(w, err)
		return
	}

	// Build the full URL from the request host
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}
	result.URL = scheme + "://" + r.Host + "/share/" + result.Slug

	JSON(w, http.StatusCreated, result)
}

// GET /share/:slug
func (h *ShareHandler) Resolve(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		BadRequest(w, "slug is required")
		return
	}

	result, err := h.svc.Resolve(r.Context(), slug)
	if errors.Is(err, services.ErrShareNotFound) {
		NotFound(w, "share link")
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	JSON(w, http.StatusOK, result)
}
