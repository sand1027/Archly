-- +goose Up
CREATE TABLE share_links (
    slug        TEXT        PRIMARY KEY,
    design_id   UUID        REFERENCES designs(id) ON DELETE SET NULL,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- elements snapshot for ad-hoc shares (no saved design)
    elements    JSONB       NOT NULL DEFAULT '[]',
    app_state   JSONB       NOT NULL DEFAULT '{}',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX share_links_expires_at_idx ON share_links (expires_at);

-- +goose Down
DROP TABLE IF EXISTS share_links;
