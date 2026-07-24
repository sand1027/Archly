-- +goose Up
-- Kafka consumer idempotency table.
-- Before processing any event, the consumer inserts (topic, partition, offset).
-- The UNIQUE constraint ensures at-most-once processing even on crash/replay.
CREATE TABLE event_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    topic        TEXT        NOT NULL,
    kafka_offset BIGINT      NOT NULL,
    partition    INT         NOT NULL,
    payload      JSONB       NOT NULL DEFAULT '{}',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (topic, partition, kafka_offset)
);

CREATE INDEX event_log_topic_idx      ON event_log (topic);
CREATE INDEX event_log_processed_idx  ON event_log (processed_at DESC);

-- +goose Down
DROP TABLE IF EXISTS event_log;
