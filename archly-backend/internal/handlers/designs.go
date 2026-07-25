package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/archly/api/internal/middleware"
	"github.com/archly/api/internal/services"
)

type DesignHandler struct {
	svc *services.DesignService
}

func NewDesignHandler(svc *services.DesignService) *DesignHandler {
	return &DesignHandler{svc: svc}
}

// GET /designs
func (h *DesignHandler) List(w http.ResponseWriter, r *http.Request) {
	tag := r.URL.Query().Get("tag")
	q := r.URL.Query().Get("q")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))

	result, err := h.svc.List(r.Context(), tag, q, int32(page), int32(pageSize))
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusOK, result)
}

// GET /designs/mine
func (h *DesignHandler) Mine(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))

	result, err := h.svc.ListMine(r.Context(), userID, int32(page), int32(pageSize))
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusOK, result)
}

// GET /designs/:id
func (h *DesignHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		BadRequest(w, "invalid design id")
		return
	}
	d, err := h.svc.Get(r.Context(), id)
	if errors.Is(err, services.ErrDesignNotFound) {
		NotFound(w, "design")
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusOK, d)
}

// POST /designs
func (h *DesignHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	var body struct {
		Title       string          `json:"title"`
		Description string          `json:"description"`
		Elements    json.RawMessage `json:"elements"`
		AppState    json.RawMessage `json:"app_state"`
		Tags        []string        `json:"tags"`
		Kind        string          `json:"kind"`
		Publish     bool            `json:"publish"`
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.Title == "" {
		BadRequest(w, "title is required")
		return
	}
	if body.Elements == nil {
		body.Elements = json.RawMessage("[]")
	}
	if body.AppState == nil {
		body.AppState = json.RawMessage("{}")
	}
	if body.Tags == nil {
		body.Tags = []string{}
	}

	d, err := h.svc.Create(r.Context(), userID, body.Title, body.Description,
		body.Elements, body.AppState, body.Tags, body.Kind, body.Publish)
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusCreated, d)
}

// PATCH /designs/:id
func (h *DesignHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		BadRequest(w, "invalid design id")
		return
	}

	var body struct {
		Title       string          `json:"title"`
		Description string          `json:"description"`
		Elements    json.RawMessage `json:"elements"`
		AppState    json.RawMessage `json:"app_state"`
		Tags        []string        `json:"tags"`
		Kind        string          `json:"kind"`
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.Elements == nil {
		body.Elements = json.RawMessage("[]")
	}
	if body.AppState == nil {
		body.AppState = json.RawMessage("{}")
	}

	d, err := h.svc.Update(r.Context(), id, userID, body.Title, body.Description,
		body.Elements, body.AppState, body.Tags, body.Kind)
	if errors.Is(err, services.ErrForbidden) {
		Forbidden(w, "you do not own this design")
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusOK, d)
}

// DELETE /designs/:id
func (h *DesignHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		BadRequest(w, "invalid design id")
		return
	}
	if err := h.svc.Delete(r.Context(), id, userID); err != nil {
		InternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /designs/:id/fork
func (h *DesignHandler) Fork(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		BadRequest(w, "invalid design id")
		return
	}
	forked, err := h.svc.Fork(r.Context(), id, userID)
	if errors.Is(err, services.ErrDesignNotFound) {
		NotFound(w, "design")
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusCreated, forked)
}

// POST /designs/:id/star
func (h *DesignHandler) Star(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		BadRequest(w, "invalid design id")
		return
	}
	starred, err := h.svc.Star(r.Context(), id, userID)
	if err != nil {
		InternalError(w, err)
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"starred": starred})
}
