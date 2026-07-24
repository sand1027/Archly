package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

var ErrShareNotFound = errors.New("share link not found or expired")

// ShareService manages short-lived canvas share links.
// Redis is the primary store (fast TTL-based expiry).
// Postgres is the audit log (slug → user mapping).
type ShareService struct {
	q   *sqlcgen.Queries
	rdb *redis.Client
}

func NewShareService(pool *pgxpool.Pool, rdb *redis.Client) *ShareService {
	return &ShareService{q: sqlcgen.NewFromPool(pool), rdb: rdb}
}

type ShareLinkResult struct {
	Slug      string          `json:"slug"`
	URL       string          `json:"url"`
	ExpiresAt time.Time       `json:"expires_at"`
	Elements  json.RawMessage `json:"elements,omitempty"`
	AppState  json.RawMessage `json:"app_state,omitempty"`
}

// Create generates a share slug, stores it in Redis with a TTL,
// and records it in Postgres for audit.
func (s *ShareService) Create(
	ctx context.Context,
	userID uuid.UUID,
	designID *uuid.UUID,
	elements json.RawMessage,
	appState json.RawMessage,
	ttlHours int,
) (*ShareLinkResult, error) {
	if ttlHours <= 0 || ttlHours > 168 {
		ttlHours = 72 // default 3 days
	}
	ttl := time.Duration(ttlHours) * time.Hour
	expiresAt := time.Now().Add(ttl)

	slug, err := generateSlug()
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}

	if elements == nil {
		elements = json.RawMessage("[]")
	}
	if appState == nil {
		appState = json.RawMessage("{}")
	}

	// Store in Redis (primary — fast resolve)
	redisKey := "share:" + slug
	payload, _ := json.Marshal(map[string]any{
		"slug":      slug,
		"design_id": designID,
		"user_id":   userID,
		"elements":  json.RawMessage(elements),
		"app_state": json.RawMessage(appState),
		"expires_at": expiresAt,
	})
	if err := s.rdb.Set(ctx, redisKey, payload, ttl).Err(); err != nil {
		return nil, fmt.Errorf("redis set share: %w", err)
	}

	// Persist to Postgres (audit — not on the hot path)
	go func() {
		bCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = s.q.CreateShareLink(bCtx, slug, designID, userID, elements, appState, expiresAt)
	}()

	return &ShareLinkResult{
		Slug:      slug,
		ExpiresAt: expiresAt,
	}, nil
}

// Resolve fetches a share link by slug. Checks Redis first, falls back to Postgres.
func (s *ShareService) Resolve(ctx context.Context, slug string) (*ShareLinkResult, error) {
	// 1. Redis fast path
	redisKey := "share:" + slug
	raw, err := s.rdb.Get(ctx, redisKey).Bytes()
	if err == nil {
		var data struct {
			Elements  json.RawMessage `json:"elements"`
			AppState  json.RawMessage `json:"app_state"`
			ExpiresAt time.Time       `json:"expires_at"`
		}
		if err := json.Unmarshal(raw, &data); err == nil {
			return &ShareLinkResult{
				Slug:      slug,
				Elements:  data.Elements,
				AppState:  data.AppState,
				ExpiresAt: data.ExpiresAt,
			}, nil
		}
	}

	// 2. Postgres fallback (Redis evicted the key)
	link, err := s.q.GetShareLink(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrShareNotFound
	}
	if err != nil {
		return nil, err
	}

	return &ShareLinkResult{
		Slug:      link.Slug,
		Elements:  link.Elements,
		AppState:  link.AppState,
		ExpiresAt: link.ExpiresAt,
	}, nil
}

func generateSlug() (string, error) {
	b := make([]byte, 6) // 12-char hex slug
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
