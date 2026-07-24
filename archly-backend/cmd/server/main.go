package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/archly/api/internal/config"
	"github.com/archly/api/internal/db"
	"github.com/archly/api/internal/handlers"
	"github.com/archly/api/internal/kafka"
	"github.com/archly/api/internal/middleware"
	"github.com/archly/api/internal/realtime"
	"github.com/archly/api/internal/services"
)

func main() {
	// ── Logger ────────────────────────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	// ── Config ────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	if cfg.IsDev() {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
		log.Info().Msg("running in development mode")
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ── Database ──────────────────────────────────────────────────────────
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()
	log.Info().Msg("connected to PostgreSQL")

	// ── Redis ─────────────────────────────────────────────────────────────
	rdb, err := newRedisClient(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to Redis")
	}
	defer rdb.Close()
	log.Info().Msg("connected to Redis")

	// ── Kafka producer ────────────────────────────────────────────────────
	producer, err := kafka.NewProducer(cfg.KafkaBrokers)
	if err != nil {
		// Non-fatal in dev — Kafka may not be running yet
		log.Warn().Err(err).Msg("kafka producer unavailable — events will be dropped")
		producer = kafka.NewNoopProducer()
	} else {
		log.Info().Msg("connected to Kafka")
		defer producer.Close()
	}

	// ── Services ──────────────────────────────────────────────────────────
	authSvc   := services.NewAuthService(pool, rdb, cfg)
	designSvc := services.NewDesignService(pool, producer)
	shareSvc  := services.NewShareService(pool, rdb)
	aiSvc     := services.NewAIService(cfg, producer)

	// ── WebSocket Hub ─────────────────────────────────────────────────────
	hub := realtime.NewHub(pool, rdb, producer)
	go hub.Run(ctx)

	// ── Kafka workers ─────────────────────────────────────────────────────
	if producer != nil && !producer.IsNoop() {
		go kafka.StartAnalyticsWorker(ctx, cfg.KafkaBrokers, pool)
		go kafka.StartRoomWorker(ctx, cfg.KafkaBrokers, pool)
		go kafka.StartNotifyWorker(ctx, cfg.KafkaBrokers, pool)
	}

	// ── Router ────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.RequestID)
	r.Use(middleware.Logger())
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health
	r.Get("/health", handlers.Health(cfg))

	// Auth routes (no JWT required)
	r.Route("/auth", func(r chi.Router) {
		ah := handlers.NewAuthHandler(authSvc)
		r.Post("/register", ah.Register)
		r.Post("/login", ah.Login)
		r.Post("/refresh", ah.Refresh)
		r.With(middleware.JWT(cfg)).Get("/me", ah.Me)
	})

	// Designs
	r.Route("/designs", func(r chi.Router) {
		dh := handlers.NewDesignHandler(designSvc)
		r.Get("/", dh.List)
		r.Get("/{id}", dh.Get)
		r.With(middleware.JWT(cfg)).Post("/", dh.Create)
		r.With(middleware.JWT(cfg)).Patch("/{id}", dh.Update)
		r.With(middleware.JWT(cfg)).Delete("/{id}", dh.Delete)
		r.With(middleware.JWT(cfg)).Post("/{id}/fork", dh.Fork)
		r.With(middleware.JWT(cfg)).Post("/{id}/star", dh.Star)
	})

	// Share links
	r.Route("/share", func(r chi.Router) {
		sh := handlers.NewShareHandler(shareSvc)
		r.With(middleware.JWT(cfg)).Post("/", sh.Create)
		r.Get("/{slug}", sh.Resolve)
	})

	// AI — no auth required, JWT optional (userID used for event tracking only)
	r.Route("/v1/ai", func(r chi.Router) {
		r.Use(middleware.JWTOptional(cfg))
		aih := handlers.NewAIHandler(aiSvc)
		r.Post("/text-to-diagram/chat-streaming", aih.TextToDiagramStream)
		r.Post("/diagram-to-code/generate", aih.DiagramToCode)
	})

	// WebSocket rooms
	r.With(middleware.JWTOptional(cfg)).Get("/ws/room/{roomId}", hub.ServeWS)

	// Internal broadcast
	r.Post("/api/broadcast", handlers.Broadcast(hub))

	// Payment webhooks (HMAC verified inside handler)
	r.Post("/webhooks/payment", handlers.PaymentWebhook(cfg))

	// ── HTTP server ───────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second, // longer for SSE
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Info().Str("port", cfg.Port).Msg("HTTP server listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	<-quit
	log.Info().Msg("shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("server forced to shutdown")
	}

	log.Info().Msg("server stopped")
}

// newRedisClient parses a Redis URL and returns a connected client.
func newRedisClient(redisURL string) (*redis.Client, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return rdb, nil
}
