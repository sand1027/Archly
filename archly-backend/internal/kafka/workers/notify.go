package workers

import (
	"context"
	"encoding/json"

	"github.com/IBM/sarama"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

// NotifyWorker consumes ai.diagram_generated and logs AI usage.
// Extended later to enforce free-tier quotas and send notifications.
type NotifyWorker struct {
	q *sqlcgen.Queries
}

func newNotifyWorker(pool *pgxpool.Pool) *NotifyWorker {
	return &NotifyWorker{q: sqlcgen.NewFromPool(pool)}
}

func (w *NotifyWorker) Setup(_ sarama.ConsumerGroupSession) error   { return nil }
func (w *NotifyWorker) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }

func (w *NotifyWorker) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		ctx := context.Background()

		already, _ := w.q.EventAlreadyProcessed(ctx, msg.Topic, msg.Partition, msg.Offset)
		if already {
			session.MarkMessage(msg, "")
			continue
		}

		w.process(ctx, msg)
		_, _ = w.q.InsertEventLog(ctx, msg.Topic, msg.Offset, msg.Partition, json.RawMessage(msg.Value))
		session.MarkMessage(msg, "")
	}
	return nil
}

func (w *NotifyWorker) process(ctx context.Context, msg *sarama.ConsumerMessage) {
	var payload struct {
		UserID string `json:"user_id"`
		Prompt string `json:"prompt"`
	}
	if err := json.Unmarshal(msg.Value, &payload); err != nil {
		return
	}
	log.Debug().Str("user_id", payload.UserID).Msg("ai.diagram_generated consumed")
	// TODO: check daily AI usage counter per user in Redis, enforce free-tier limit
}

// NewNotifyConsumer is the exported constructor used by kafka.StartNotifyWorker.
func NewNotifyConsumer(pool *pgxpool.Pool) *NotifyWorker {
	return newNotifyWorker(pool)
}
