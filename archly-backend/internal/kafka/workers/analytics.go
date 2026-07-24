package workers

import (
	"context"
	"encoding/json"

	"github.com/IBM/sarama"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/archly/api/internal/kafka/topics"
	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

// AnalyticsWorker consumes design.published, design.forked, share.viewed
// and increments counters in Postgres.
type AnalyticsWorker struct {
	q *sqlcgen.Queries
}

func newAnalyticsWorker(pool *pgxpool.Pool) *AnalyticsWorker {
	return &AnalyticsWorker{q: sqlcgen.NewFromPool(pool)}
}

func (w *AnalyticsWorker) Setup(_ sarama.ConsumerGroupSession) error   { return nil }
func (w *AnalyticsWorker) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }

func (w *AnalyticsWorker) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		ctx := context.Background()

		// Idempotency check
		already, _ := w.q.EventAlreadyProcessed(ctx, msg.Topic, msg.Partition, msg.Offset)
		if already {
			session.MarkMessage(msg, "")
			continue
		}

		// Process
		w.process(ctx, msg)

		// Record in event_log
		_, _ = w.q.InsertEventLog(ctx, msg.Topic, msg.Offset, msg.Partition, json.RawMessage(msg.Value))
		session.MarkMessage(msg, "")
	}
	return nil
}

func (w *AnalyticsWorker) process(ctx context.Context, msg *sarama.ConsumerMessage) {
	var payload struct {
		DesignID string `json:"design_id"`
	}
	if err := json.Unmarshal(msg.Value, &payload); err != nil {
		return
	}
	id, err := uuid.Parse(payload.DesignID)
	if err != nil {
		return
	}

	switch msg.Topic {
	case topics.DesignForked:
		if err := w.q.IncrementForkCount(ctx, id); err != nil {
			log.Warn().Err(err).Str("design_id", payload.DesignID).Msg("analytics: increment fork")
		}
	case topics.DesignViewed:
		if err := w.q.IncrementForkCount(ctx, id); err != nil {
			log.Warn().Err(err).Str("design_id", payload.DesignID).Msg("analytics: increment view")
		}
	}
}

// NewAnalyticsConsumer is the exported constructor used by kafka.StartAnalyticsWorker.
func NewAnalyticsConsumer(pool *pgxpool.Pool) *AnalyticsWorker {
	return newAnalyticsWorker(pool)
}
