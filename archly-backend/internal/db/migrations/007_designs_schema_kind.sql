-- +goose Up
-- Allow designs.kind = 'schema' for Database ERD documents.
ALTER TABLE designs DROP CONSTRAINT IF EXISTS designs_kind_check;
ALTER TABLE designs
  ADD CONSTRAINT designs_kind_check
  CHECK (kind IN ('canvas', 'flow', 'schema'));

-- +goose Down
ALTER TABLE designs DROP CONSTRAINT IF EXISTS designs_kind_check;
ALTER TABLE designs
  ADD CONSTRAINT designs_kind_check
  CHECK (kind IN ('canvas', 'flow'));
