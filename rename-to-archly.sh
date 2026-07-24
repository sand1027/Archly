#!/usr/bin/env bash
# ============================================================
# Rename paperdraw → Archly
#
# What this script does:
#   1. In-file text replacements (all source files)
#   2. Rename subdirectories: paperdraw-frontend → archly-frontend
#                             paperdraw-backend  → archly-backend
#   3. Rename the root folder: paperdraw → archly
#      (cd to parent first, then mv)
#
# Run from OUTSIDE the paperdraw folder:
#   cd ~/Desktop && bash paperdraw/rename-to-archly.sh
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"   # /Users/…/paperdraw
PARENT="$(dirname "$ROOT")"             # /Users/…/Desktop

echo "=== Archly rename script ==="
echo "Root: $ROOT"
echo ""

# ── 1. In-file replacements ──────────────────────────────────────────────────
# We process every text file, skipping binary files and .git

replace_in_files() {
  local dir="$1"
  # Find all non-binary files, skip .git and node_modules and .next
  find "$dir" -type f \
    ! -path "*/.git/*" \
    ! -path "*/node_modules/*" \
    ! -path "*/.next/*" \
    ! -path "*/dist/*" \
    ! -name "*.png" ! -name "*.jpg" ! -name "*.jpeg" ! -name "*.gif" \
    ! -name "*.ico" ! -name "*.woff" ! -name "*.woff2" ! -name "*.ttf" \
    ! -name "*.eot" ! -name "*.otf" ! -name "*.webp" ! -name "*.svg" \
    ! -name "*.DS_Store" ! -name "rename-to-archly.sh" \
  | while IFS= read -r file; do
      # Check it's a text file
      if file "$file" | grep -qE 'text|JSON|script|source'; then
        # macOS sed needs '' for -i
        sed -i '' \
          -e 's/PaperDraw/Archly/g' \
          -e 's/paperdraw/archly/g' \
          -e 's/PAPERDRAW/ARCHLY/g' \
          -e 's/paper-draw/archly/g' \
          -e 's/paper_draw/archly/g' \
          "$file" 2>/dev/null || true
      fi
    done
}

echo "Step 1: Replacing text inside files..."
replace_in_files "$ROOT"
echo "  Done."

# ── 2. Rename subdirectories ──────────────────────────────────────────────────
echo ""
echo "Step 2: Renaming subdirectories..."

if [ -d "$ROOT/paperdraw-frontend" ]; then
  mv "$ROOT/paperdraw-frontend" "$ROOT/archly-frontend"
  echo "  paperdraw-frontend → archly-frontend"
fi

if [ -d "$ROOT/paperdraw-backend" ]; then
  mv "$ROOT/paperdraw-backend" "$ROOT/archly-backend"
  echo "  paperdraw-backend → archly-backend"
fi

# ── 3. Rename the root folder ─────────────────────────────────────────────────
echo ""
echo "Step 3: Renaming root folder..."
NEW_ROOT="$PARENT/archly"

if [ -d "$NEW_ROOT" ]; then
  echo "  WARNING: $NEW_ROOT already exists — skipping root rename."
  echo "  Manually run: mv \"$ROOT\" \"$NEW_ROOT\""
else
  mv "$ROOT" "$NEW_ROOT"
  echo "  paperdraw → archly"
  echo ""
  echo "=== Done! Project is now at: $NEW_ROOT ==="
  echo ""
  echo "Next steps:"
  echo "  cd $NEW_ROOT"
  echo "  docker compose down -v && docker compose up -d"
  echo "  # Frontend: cd archly-frontend && npm install (if lock file changed)"
fi
