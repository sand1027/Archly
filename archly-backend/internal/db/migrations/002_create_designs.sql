-- +goose Up
CREATE TABLE designs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    elements    JSONB       NOT NULL DEFAULT '[]',
    app_state   JSONB       NOT NULL DEFAULT '{}',
    tags        TEXT[]      NOT NULL DEFAULT '{}',
    fork_count  INT         NOT NULL DEFAULT 0,
    star_count  INT         NOT NULL DEFAULT 0,
    view_count  INT         NOT NULL DEFAULT 0,
    published   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For listing community gallery (published + sorted by date)
CREATE INDEX designs_published_created_idx ON designs (published, created_at DESC);
-- For tag filtering
CREATE INDEX designs_tags_gin ON designs USING GIN (tags);
-- For JSONB element searches (advanced — optional at first)
CREATE INDEX designs_elements_gin ON designs USING GIN (elements);
-- For user's own designs
CREATE INDEX designs_user_id_idx ON designs (user_id);

CREATE TABLE design_forks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID        NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    fork_id     UUID        NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE design_stars (
    design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (design_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS design_stars;
DROP TABLE IF EXISTS design_forks;
DROP TABLE IF EXISTS designs;
