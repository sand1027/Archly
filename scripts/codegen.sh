#!/usr/bin/env bash
# =============================================================
# Archly — Full Codegen Pipeline
#
# Runs:
#   1. swaggo     → generates openapi.yaml from Go handler annotations
#   2. sqlc       → generates type-safe Go code from .sql query files
#   3. openapi-ts → generates TypeScript types from openapi.yaml
#
# Run this every time you:
#   - Add or change a Go API handler
#   - Add or change a SQL query in sqlc/queries/
#   - Add a new table (update migrations first, then re-run)
# =============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/apps/api"
CODEGEN_DIR="$ROOT/packages/codegen"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Archly Codegen Pipeline"
echo "═══════════════════════════════════════════════"

# ─── Step 1: Generate OpenAPI spec (swaggo) ──────────────────
echo ""
echo "▶  Step 1/3 — Generating OpenAPI spec (swaggo)..."
cd "$API_DIR"

if ! command -v swag &>/dev/null; then
  echo "   Installing swaggo..."
  go install github.com/swaggo/swag/cmd/swag@latest
fi

swag init \
  --dir ./cmd/server,./internal/api/handlers \
  --output ./openapi \
  --outputTypes yaml \
  --parseInternal \
  --quiet

echo "   ✓ openapi.yaml written to apps/api/openapi/"

# ─── Step 2: Generate sqlc Go code ───────────────────────────
echo ""
echo "▶  Step 2/3 — Generating sqlc Go code..."
cd "$API_DIR"

if ! command -v sqlc &>/dev/null; then
  echo "   Installing sqlc..."
  go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
fi

sqlc generate

echo "   ✓ Go code written to apps/api/sqlc/generated/"

# ─── Step 3: Generate TypeScript types (openapi-typescript) ──
echo ""
echo "▶  Step 3/3 — Generating TypeScript types (openapi-typescript)..."
cd "$ROOT"

# Install packages if node_modules missing
if [ ! -d "$CODEGEN_DIR/node_modules" ]; then
  echo "   Running npm install..."
  npm install --workspace=packages/codegen
fi

npm run generate --workspace=packages/codegen

echo "   ✓ TypeScript types written to packages/types/generated/api.ts"

# ─── Drift check (for CI) ─────────────────────────────────────
if [ "${CI:-false}" = "true" ]; then
  echo ""
  echo "▶  CI drift check..."
  if ! git diff --exit-code --quiet \
      apps/api/openapi/openapi.yaml \
      apps/api/sqlc/generated/ \
      packages/types/generated/api.ts; then
    echo ""
    echo "✗  CODEGEN DRIFT DETECTED"
    echo "   Generated files are out of date."
    echo "   Run ./scripts/codegen.sh locally and commit the result."
    echo ""
    git diff --stat apps/api/openapi/ apps/api/sqlc/generated/ packages/types/generated/
    exit 1
  fi
  echo "   ✓ No drift detected"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Codegen complete"
echo "═══════════════════════════════════════════════"
echo ""
