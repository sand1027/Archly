package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/archly/api/internal/config"
	"github.com/archly/api/internal/middleware"
	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

var (
	ErrEmailTaken      = errors.New("email already registered")
	ErrInvalidCreds    = errors.New("invalid email or password")
	ErrTokenExpired    = errors.New("refresh token expired or not found")
)

type AuthService struct {
	q   *sqlcgen.Queries
	rdb *redis.Client
	cfg *config.Config
}

func NewAuthService(pool *pgxpool.Pool, rdb *redis.Client, cfg *config.Config) *AuthService {
	return &AuthService{q: sqlcgen.NewFromPool(pool), rdb: rdb, cfg: cfg}
}

type AuthResult struct {
	AccessToken  string
	RefreshToken string
	User         sqlcgen.User
}

// Register creates a new user account and returns tokens.
func (s *AuthService) Register(ctx context.Context, email, password, displayName string) (*AuthResult, error) {
	// Check email uniqueness
	if _, err := s.q.GetUserByEmail(ctx, email); err == nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.q.CreateUser(ctx, email, string(hash), displayName)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	return s.issueTokens(ctx, user)
}

// Login verifies credentials and returns tokens.
func (s *AuthService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	user, err := s.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCreds
		}
		return nil, fmt.Errorf("get user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}

	return s.issueTokens(ctx, user)
}

// Refresh rotates the refresh token and issues a new access token.
func (s *AuthService) Refresh(ctx context.Context, rawRefreshToken string) (*AuthResult, error) {
	hash := hashToken(rawRefreshToken)

	rt, err := s.q.GetRefreshToken(ctx, hash)
	if err != nil {
		return nil, ErrTokenExpired
	}

	// Rotate — delete old token
	if err := s.q.DeleteRefreshToken(ctx, hash); err != nil {
		return nil, fmt.Errorf("delete old token: %w", err)
	}

	user, err := s.q.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}

	return s.issueTokens(ctx, user)
}

// GetUser returns the user for a given ID.
func (s *AuthService) GetUser(ctx context.Context, id uuid.UUID) (sqlcgen.User, error) {
	return s.q.GetUserByID(ctx, id)
}

// ─── private ──────────────────────────────────────────────────────────────

func (s *AuthService) issueTokens(ctx context.Context, user sqlcgen.User) (*AuthResult, error) {
	// Access token (short-lived JWT)
	now := time.Now()
	claims := &middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Tier:   user.Tier,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.JWTAccessTTL)),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	// Refresh token (opaque random bytes stored hashed in DB)
	rawRefresh, err := generateToken(32)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	if _, err := s.q.CreateRefreshToken(ctx, user.ID, hashToken(rawRefresh),
		now.Add(s.cfg.JWTRefreshTTL)); err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		User:         user,
	}, nil
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func generateToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
