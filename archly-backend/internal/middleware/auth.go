package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/archly/api/internal/config"
)

type contextKey string

const (
	ContextKeyUserID contextKey = "user_id"
	ContextKeyTier   contextKey = "tier"
)

// Claims is the JWT payload stored in every token.
type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Tier   string    `json:"tier"`
	jwt.RegisteredClaims
}

// JWT enforces that a valid Bearer token is present.
// Returns 401 if missing or invalid.
func JWT(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := extractClaims(r, cfg.JWTSecret)
			if err != nil {
				http.Error(w, `{"code":"UNAUTHORIZED","message":"invalid or missing token"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyTier, claims.Tier)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// JWTOptional extracts claims if a valid token is present but does NOT block
// the request if no token is provided (used for WS rooms — anonymous read-only).
func JWTOptional(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if claims, err := extractClaims(r, cfg.JWTSecret); err == nil {
				ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
				ctx = context.WithValue(ctx, ContextKeyTier, claims.Tier)
				r = r.WithContext(ctx)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// UserIDFromCtx extracts the authenticated user's UUID from context.
// Returns zero UUID and false if not authenticated.
func UserIDFromCtx(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(ContextKeyUserID).(uuid.UUID)
	return id, ok && id != uuid.Nil
}

// TierFromCtx extracts the user's subscription tier from context.
func TierFromCtx(ctx context.Context) string {
	tier, _ := ctx.Value(ContextKeyTier).(string)
	if tier == "" {
		return "free"
	}
	return tier
}

// IsProFromCtx returns true if the user has a plus or pro tier.
func IsProFromCtx(ctx context.Context) bool {
	t := TierFromCtx(ctx)
	return t == "plus" || t == "pro"
}

// ─── helpers ──────────────────────────────────────────────────────────────

func extractClaims(r *http.Request, secret string) (*Claims, error) {
	raw := ""

	// 1. Authorization: Bearer <token>
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		raw = strings.TrimPrefix(auth, "Bearer ")
	}

	// 2. ?token= query param (WebSocket handshake)
	if raw == "" {
		raw = r.URL.Query().Get("token")
	}

	if raw == "" {
		return nil, jwt.ErrTokenNotValidYet
	}

	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}
