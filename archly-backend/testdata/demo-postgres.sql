-- Archly demo schema for local Postgres import testing.
-- Safe sample data only — no production credentials.

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  body        TEXT,
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id),
  author_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID NOT NULL REFERENCES posts(id),
  tag_id  UUID NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', 'Bob')
ON CONFLICT DO NOTHING;

INSERT INTO posts (id, author_id, title, body, published) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Hello Archly', 'First post', true),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Schema import', 'Testing FKs', true)
ON CONFLICT DO NOTHING;

INSERT INTO comments (post_id, author_id, body) VALUES
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Nice post!')
ON CONFLICT DO NOTHING;

INSERT INTO tags (id, name) VALUES
  ('55555555-5555-5555-5555-555555555555', 'demo'),
  ('66666666-6666-6666-6666-666666666666', 'schema')
ON CONFLICT DO NOTHING;

INSERT INTO post_tags (post_id, tag_id) VALUES
  ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555'),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666')
ON CONFLICT DO NOTHING;
