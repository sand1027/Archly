-- +goose Up
ALTER TABLE designs
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'canvas'
    CHECK (kind IN ('canvas', 'flow'));

-- For listing a user's own saved sessions (history), newest first
CREATE INDEX designs_user_updated_idx ON designs (user_id, updated_at DESC);

-- +goose Down
DROP INDEX IF EXISTS designs_user_updated_idx;
ALTER TABLE designs DROP COLUMN IF EXISTS kind;
