package handlers

import (
	"net/http"

	"github.com/archly/api/internal/config"
)

// Health returns a simple liveness probe handler.
func Health(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, map[string]string{
			"status":      "ok",
			"environment": cfg.Environment,
			"version":     "1.0.0",
		})
	}
}
