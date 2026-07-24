#!/usr/bin/env bash
# =============================================================
# Archly — Kafka Topic Creator
#
# Creates all required Kafka topics with correct configurations.
# Run this once after Kafka starts for the first time.
#
# Usage:
#   ./scripts/topics.sh                     → create topics (default: kafka:29092)
#   KAFKA_BROKER=localhost:9092 ./scripts/topics.sh → use custom broker
# =============================================================

set -euo pipefail

KAFKA_BROKER="${KAFKA_BROKER:-kafka:29092}"

# If running outside Docker, use localhost
if [ "${KAFKA_BROKER}" = "kafka:29092" ] && ! ping -c 1 kafka &>/dev/null 2>&1; then
  KAFKA_BROKER="localhost:9092"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Archly — Kafka Topic Setup"
echo "  Broker: $KAFKA_BROKER"
echo "═══════════════════════════════════════════════"

# Topics configuration
# Format: "topic-name:partitions:replication-factor:retention-ms"
TOPICS=(
  "design.published:3:1:604800000"
  "design.forked:3:1:604800000"
  "ai.diagram_generated:1:1:259200000"
  "share.viewed:2:1:86400000"
  "room.state_saved:3:1:86400000"
)

create_topic() {
  local name="$1"
  local partitions="$2"
  local replication="$3"
  local retention_ms="$4"

  echo ""
  echo "▶  Creating topic: $name"
  echo "   partitions=$partitions  replication=$replication  retention=${retention_ms}ms"

  kafka-topics.sh \
    --bootstrap-server "$KAFKA_BROKER" \
    --create \
    --if-not-exists \
    --topic "$name" \
    --partitions "$partitions" \
    --replication-factor "$replication" \
    --config retention.ms="$retention_ms" \
    --config cleanup.policy=delete

  echo "   ✓ $name"
}

# Wait for Kafka to be ready
echo ""
echo "▶  Waiting for Kafka to be ready..."
MAX_RETRIES=30
RETRY=0
until kafka-topics.sh --bootstrap-server "$KAFKA_BROKER" --list &>/dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "✗  Kafka not available after ${MAX_RETRIES} retries. Is it running?"
    exit 1
  fi
  echo "   Waiting... ($RETRY/$MAX_RETRIES)"
  sleep 2
done
echo "   ✓ Kafka is ready"

# Create all topics
for entry in "${TOPICS[@]}"; do
  IFS=':' read -r name partitions replication retention <<< "$entry"
  create_topic "$name" "$partitions" "$replication" "$retention"
done

echo ""
echo "▶  Current topics:"
kafka-topics.sh --bootstrap-server "$KAFKA_BROKER" --list

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ All topics created"
echo "═══════════════════════════════════════════════"
echo ""
