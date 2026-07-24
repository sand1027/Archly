package workers

import (
	"context"
	"encoding/json"

	"github.com/IBM/sarama"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

// RoomWorker consumes room.state_saved and persists the canvas snapshot to Postgres.
type RoomWorker struct {
	q    *sqlcgen.Queries
	pool *pgxpool.Pool
}

func newRoomWorker(pool *pgxpool.Pool) *RoomWorker {
	return &RoomWorker{q: sqlcgen.NewFromPool(pool), pool: pool}
}

func (w *RoomWorker) Setup(_ sarama.ConsumerGroupSession) error   { return nil }
func (w *RoomWorker) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }

func (w *RoomWorker) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
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

func (w *RoomWorker) process(ctx context.Context, msg *sarama.ConsumerMessage) {
	var payload struct {
		RoomID   string          `json:"room_id"`
		Elements json.RawMessage `json:"elements"`
		AppState json.RawMessage `json:"app_state"`
	}
	if err := json.Unmarshal(msg.Value, &payload); err != nil {
		return
	}

	roomID, err := uuid.Parse(payload.RoomID)
	if err != nil {
		return
	}

	if payload.Elements == nil {
		payload.Elements = json.RawMessage("[]")
	}
	if payload.AppState == nil {
		payload.AppState = json.RawMessage("{}")
	}

	// Upsert room state
	if _, err := w.q.UpdateCollabRoom(ctx, roomID, payload.Elements, payload.AppState); err != nil {
		// Room may not exist yet — create it
		if _, err2 := w.q.CreateCollabRoom(ctx, nil, payload.Elements, payload.AppState); err2 != nil {
			log.Warn().Err(err2).Str("room_id", payload.RoomID).Msg("room worker: upsert failed")
		}
	}
}

// NewRoomConsumer is the exported constructor used by kafka.StartRoomWorker.
func NewRoomConsumer(pool *pgxpool.Pool) *RoomWorker {
	return newRoomWorker(pool)
}
