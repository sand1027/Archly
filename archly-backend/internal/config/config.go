package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	// Server
	Port        string
	Environment string
	CORSOrigins []string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// Kafka
	KafkaBrokers []string

	// JWT
	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration

	// AI — Groq (primary cloud)
	GroqAPIKey string
	GroqModel  string

	// AI — GitHub Models (fallback)
	GitHubModelsToken string
	GitHubModelsModel string

	// AI — OpenRouter (fallback)
	OpenRouterAPIKey string
	OpenRouterModel  string

	// AI — NVIDIA NIM (integrate.api.nvidia.com)
	NvidiaAPIKey         string
	NvidiaModel          string // default: meta/llama-3.3-70b-instruct
	NvidiaNemotronModel  string
	NvidiaDeepSeekModel  string

	// AI — Ollama (local, highest priority when set)
	OllamaBaseURL     string
	OllamaModel       string // architecture (archly-architect Modelfile)
	OllamaSchemaModel string // schema / ERD (archly-schema Modelfile)

	// Payments
	StripeSecretKey      string
	StripeWebhookSecret  string
	PayPalClientID       string
	PayPalClientSecret   string
}

// Load reads configuration from environment variables.
// Loads .env file if present (ignored in production where real env vars are set).
func Load() (*Config, error) {
	// Load .env if it exists — ignored if missing
	_ = godotenv.Load()

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		Environment: getEnv("ENVIRONMENT", "development"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		GroqAPIKey:           getEnv("GROQ_API_KEY", ""),
		GroqModel:            getEnv("GROQ_MODEL", "llama-3.3-70b-versatile"),
		GitHubModelsToken:    getEnv("GITHUB_MODELS_TOKEN", ""),
		GitHubModelsModel:    getEnv("GITHUB_MODELS_MODEL", "gpt-4o-mini"),
		OpenRouterAPIKey:     getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:      getEnv("OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free"),
		NvidiaAPIKey:         getEnv("NVIDIA_API_KEY", ""),
		NvidiaModel:          getEnv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct"),
		NvidiaNemotronModel:  getEnv("NVIDIA_NEMOTRON_MODEL", "nvidia/llama-3.3-nemotron-super-49b-v1.5"),
		NvidiaDeepSeekModel:  getEnv("NVIDIA_DEEPSEEK_MODEL", "deepseek-ai/deepseek-v4-pro"),
		OllamaBaseURL:        getEnv("OLLAMA_BASE_URL", ""),
		OllamaModel:          getEnv("OLLAMA_MODEL", "archly-architect"),
		OllamaSchemaModel:    getEnv("OLLAMA_SCHEMA_MODEL", "archly-schema"),
		StripeSecretKey:       getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret:   getEnv("STRIPE_WEBHOOK_SECRET", ""),
		PayPalClientID:        getEnv("PAYPAL_CLIENT_ID", ""),
		PayPalClientSecret:    getEnv("PAYPAL_CLIENT_SECRET", ""),
	}

	// CORS origins — comma separated
	origins := getEnv("CORS_ORIGINS", "http://localhost:3000")
	cfg.CORSOrigins = splitTrim(origins, ",")

	// Kafka brokers — comma separated
	brokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	cfg.KafkaBrokers = splitTrim(brokers, ",")

	// JWT secret — required
	cfg.JWTSecret = getEnv("JWT_SECRET", "")
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	// JWT TTLs
	var err error
	cfg.JWTAccessTTL, err = parseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("JWT_ACCESS_TTL: %w", err)
	}
	cfg.JWTRefreshTTL, err = parseDuration(getEnv("JWT_REFRESH_TTL", "168h")) // 7 days
	if err != nil {
		return nil, fmt.Errorf("JWT_REFRESH_TTL: %w", err)
	}

	// Database URL — required
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

// IsDev returns true when running in development mode.
func (c *Config) IsDev() bool {
	return c.Environment == "development"
}

// IsProd returns true when running in production mode.
func (c *Config) IsProd() bool {
	return c.Environment == "production"
}

// ─── helpers ──────────────────────────────────────────────────────────────

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func splitTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// parseDuration parses "15m", "7d", "168h", "24h" etc.
// Adds support for "d" (days) which Go's time.ParseDuration doesn't support.
func parseDuration(s string) (time.Duration, error) {
	if strings.HasSuffix(s, "d") {
		days, err := strconv.Atoi(strings.TrimSuffix(s, "d"))
		if err != nil {
			return 0, fmt.Errorf("invalid duration %q", s)
		}
		return time.Duration(days) * 24 * time.Hour, nil
	}
	return time.ParseDuration(s)
}

// Ensure getEnvInt is used (suppress lint warning)
var _ = getEnvInt
