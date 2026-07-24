package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"

	"github.com/archly/api/internal/config"
)

// PaymentWebhook handles Stripe / PayPal webhooks.
// Verifies HMAC signature before processing.
func PaymentWebhook(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB max
		if err != nil {
			BadRequest(w, "failed to read body")
			return
		}

		// Stripe webhook signature verification
		if cfg.StripeWebhookSecret != "" {
			sig := r.Header.Get("Stripe-Signature")
			if !verifyStripeSignature(body, sig, cfg.StripeWebhookSecret) {
				Error(w, http.StatusUnauthorized, "INVALID_SIGNATURE", "webhook signature invalid")
				return
			}
		}

		var event struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(body, &event); err != nil {
			BadRequest(w, "invalid JSON")
			return
		}

		// Handle relevant Stripe events
		switch event.Type {
		case "customer.subscription.created", "customer.subscription.updated":
			// TODO: extract customer ID, look up user, update tier to "plus"
		case "customer.subscription.deleted":
			// TODO: downgrade user tier to "free"
		case "invoice.payment_succeeded":
			// TODO: extend subscription
		}

		// Always return 200 to Stripe so it stops retrying
		JSON(w, http.StatusOK, map[string]string{"received": "true"})
	}
}

// Broadcast is an internal endpoint for server-to-room broadcast.
func Broadcast(hub interface{ BroadcastToRoom(roomID string, msg []byte) }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			RoomID  string          `json:"room_id"`
			Message json.RawMessage `json:"message"`
		}
		if !Decode(w, r, &body) {
			return
		}
		hub.BroadcastToRoom(body.RoomID, body.Message)
		JSON(w, http.StatusOK, map[string]string{"ok": "true"})
	}
}

// verifyStripeSignature validates the Stripe-Signature header.
func verifyStripeSignature(payload []byte, header, secret string) bool {
	if header == "" || secret == "" {
		return false
	}
	// Simplified — production should parse t= and v1= from the header
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(header))
}
