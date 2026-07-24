-- name: InsertEventLog :one
INSERT INTO event_log (topic, kafka_offset, partition, payload)
VALUES ($1, $2, $3, $4)
ON CONFLICT (topic, partition, kafka_offset) DO NOTHING
RETURNING id;

-- name: EventAlreadyProcessed :one
SELECT EXISTS(
    SELECT 1 FROM event_log
    WHERE topic = $1 AND partition = $2 AND kafka_offset = $3
) AS processed;
