package middleware

import (
	"net/http"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
)

// Logger returns a chi-compatible zerolog request logger middleware.
func Logger() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := chimiddleware.NewWrapResponseWriter(w, r.ProtoMajor)

			defer func() {
				log.Info().
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("request_id", chimiddleware.GetReqID(r.Context())).
					Int("status", ww.Status()).
					Int("bytes", ww.BytesWritten()).
					Dur("duration", time.Since(start)).
					Str("remote", r.RemoteAddr).
					Msg("request")
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
