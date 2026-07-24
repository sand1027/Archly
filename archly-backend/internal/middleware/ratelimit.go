package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimit returns middleware that enforces a sliding-window rate limit
// using Redis. key is a function that derives the limit key from the request
// (e.g. IP, user ID). limit is requests allowed per window.
func RateLimit(rdb *redis.Client, limit int, window time.Duration, key func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			k := fmt.Sprintf("rl:%s", key(r))
			ctx := r.Context()

			count, err := increment(ctx, rdb, k, window)
			if err != nil {
				// Redis unavailable — fail open (don't block legitimate traffic)
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", max(0, limit-int(count))))

			if int(count) > limit {
				w.Header().Set("Retry-After", fmt.Sprintf("%.0f", window.Seconds()))
				http.Error(w,
					`{"code":"RATE_LIMIT_EXCEEDED","message":"too many requests"}`,
					http.StatusTooManyRequests,
				)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// IPKey derives the rate-limit key from the request's real IP.
func IPKey(r *http.Request) string {
	return r.RemoteAddr
}

// UserKey derives the rate-limit key from the authenticated user ID.
// Falls back to IP if not authenticated.
func UserKey(r *http.Request) string {
	if id, ok := UserIDFromCtx(r.Context()); ok {
		return id.String()
	}
	return r.RemoteAddr
}

func increment(ctx context.Context, rdb *redis.Client, key string, window time.Duration) (int64, error) {
	pipe := rdb.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
