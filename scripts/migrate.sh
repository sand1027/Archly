#!/usr/bin/env bash
# =============================================================
# Archly — Database Migration Runner
#
# Usage:
#   ./scripts/migrate.sh           → run all pending migrations (up)
#   ./scripts/migrate.sh down      → roll back the last migration
#   ./scripts/migrate.sh down 3    → roll back last 3 migrations
#   ./scripts/migrate.sh status    → show migration status
#   ./scripts/migrate.sh create name_here → create new migration files
#
# Requires DATABASE_URL in .env or environment
# =============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/apps/api"
MIGRATIONS_DIR="$API_DIR/internal/db/migrations"

# Load .env if present
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "✗  DATABASE_URL is not set. Copy .env.example to .env and fill it in."
  exit 1
fi

# Install goose if missing
if ! command -v goose &>/dev/null; then
  echo "▶  Installing goose..."
  go install github.com/pressly/goose/v3/cmd/goose@latest
fi

COMMAND="${1:-up}"
EXTRA="${2:-}"

cd "$MIGRATIONS_DIR"

case "$COMMAND" in
  up)
    echo "▶  Running migrations (up)..."
    goose postgres "$DATABASE_URL" up
    echo "✓  Migrations complete"
    ;;
  down)
    COUNT="${EXTRA:-1}"
    echo "▶  Rolling back $COUNT migration(s)..."
    for i in $(seq 1 "$COUNT"); do
      goose postgres "$DATABASE_URL" down
    done
    echo "✓  Rollback complete"
    ;;
  status)
    echo "▶  Migration status:"
    goose postgres "$DATABASE_URL" status
    ;;
  create)
    if [ -z "$EXTRA" ]; then
      echo "✗  Provide a migration name: ./scripts/migrate.sh create add_indexes"
      exit 1
    fi
    goose postgres "$DATABASE_URL" create "$EXTRA" sql
    echo "✓  Created migration: $EXTRA"
    ;;
  reset)
    echo "▶  Resetting all migrations (down to 0)..."
    goose postgres "$DATABASE_URL" reset
    echo "▶  Re-running all migrations..."
    goose postgres "$DATABASE_URL" up
    echo "✓  Reset complete"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Usage: $0 [up|down|status|create|reset] [args]"
    exit 1
    ;;
esac
