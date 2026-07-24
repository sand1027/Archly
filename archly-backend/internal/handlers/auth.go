package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/archly/api/internal/middleware"
	"github.com/archly/api/internal/services"
)

type AuthHandler struct {
	svc *services.AuthService
}

func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// POST /auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if !Decode(w, r, &body) {
		return
	}

	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	if body.Email == "" || body.Password == "" || body.DisplayName == "" {
		BadRequest(w, "email, password and display_name are required")
		return
	}
	if len(body.Password) < 8 {
		BadRequest(w, "password must be at least 8 characters")
		return
	}

	result, err := h.svc.Register(r.Context(), body.Email, body.Password, body.DisplayName)
	if err != nil {
		if errors.Is(err, services.ErrEmailTaken) {
			Error(w, http.StatusConflict, "EMAIL_TAKEN", "email already registered")
			return
		}
		InternalError(w, err)
		return
	}

	JSON(w, http.StatusCreated, authResponse(result))
}

// POST /auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !Decode(w, r, &body) {
		return
	}

	result, err := h.svc.Login(r.Context(), strings.ToLower(body.Email), body.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCreds) {
			Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
			return
		}
		InternalError(w, err)
		return
	}

	JSON(w, http.StatusOK, authResponse(result))
}

// POST /auth/refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.RefreshToken == "" {
		BadRequest(w, "refresh_token is required")
		return
	}

	result, err := h.svc.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		if errors.Is(err, services.ErrTokenExpired) {
			Error(w, http.StatusUnauthorized, "TOKEN_EXPIRED", "refresh token expired or not found")
			return
		}
		InternalError(w, err)
		return
	}

	JSON(w, http.StatusOK, authResponse(result))
}

// GET /auth/me  (JWT required)
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	user, err := h.svc.GetUser(r.Context(), userID)
	if err != nil {
		NotFound(w, "user")
		return
	}

	JSON(w, http.StatusOK, map[string]any{
		"id":           user.ID,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"avatar_url":   user.AvatarUrl,
		"tier":         user.Tier,
		"created_at":   user.CreatedAt,
	})
}

func authResponse(r *services.AuthResult) map[string]any {
	return map[string]any{
		"access_token":  r.AccessToken,
		"refresh_token": r.RefreshToken,
		"user": map[string]any{
			"id":           r.User.ID,
			"email":        r.User.Email,
			"display_name": r.User.DisplayName,
			"avatar_url":   r.User.AvatarUrl,
			"tier":         r.User.Tier,
		},
	}
}
