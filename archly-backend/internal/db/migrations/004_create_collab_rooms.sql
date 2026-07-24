-- +goose Up
CREATE TABLE collab_rooms (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id  UUID        REFERENCES designs(id) ON DELETE SET NULL,
    elements   JSONB       NOT NULL DEFAULT '[]',
    app_state  JSONB       NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX collab_rooms_design_id_idx ON collab_rooms (design_id);

-- +goose Down
DROP TABLE IF EXISTS collab_rooms;
