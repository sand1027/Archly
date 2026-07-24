#!/usr/bin/env bash
# =============================================================
# Archly — Database Seeder
#
# Seeds the database with:
#   - 1 admin user
#   - 10 community design templates (pre-built architectures)
#
# Usage:
#   ./scripts/seed.sh              → seed everything
#   ./scripts/seed.sh templates    → seed only templates
#   ./scripts/seed.sh reset        → truncate + re-seed
# =============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/apps/api"

# Load .env
if [ -f "$ROOT/.env" ]; then
  set -a; source "$ROOT/.env"; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "✗  DATABASE_URL not set."
  exit 1
fi

COMMAND="${1:-all}"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Archly — Database Seeder"
echo "═══════════════════════════════════════════════"

if [ "$COMMAND" = "reset" ]; then
  echo ""
  echo "▶  Truncating seeded data..."
  psql "$DATABASE_URL" <<-SQL
    DELETE FROM design_stars;
    DELETE FROM design_forks;
    DELETE FROM designs WHERE is_template = true;
    DELETE FROM users WHERE email = 'admin@archly.dev';
SQL
  echo "   ✓ Truncated"
fi

# Build and run the Go seed binary
echo ""
echo "▶  Building seed binary..."
cd "$API_DIR"
go build -o /tmp/archly-seed ./cmd/seed/main.go
echo "   ✓ Built"

echo ""
echo "▶  Running seeder..."
DATABASE_URL="$DATABASE_URL" /tmp/archly-seed

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Seed complete"
echo "═══════════════════════════════════════════════"
echo ""
