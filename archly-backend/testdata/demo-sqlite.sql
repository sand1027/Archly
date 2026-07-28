-- SQLite demo schema for Archly import testing.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);

INSERT OR IGNORE INTO users (id, email, name) VALUES
  (1, 'alice@example.com', 'Alice'),
  (2, 'bob@example.com', 'Bob');

INSERT OR IGNORE INTO posts (id, author_id, title, body, published) VALUES
  (1, 1, 'Hello Archly', 'First post', 1),
  (2, 2, 'Schema import', 'Testing FKs', 1);

INSERT OR IGNORE INTO comments (id, post_id, author_id, body) VALUES
  (1, 1, 2, 'Nice post!');

INSERT OR IGNORE INTO tags (id, name) VALUES
  (1, 'demo'),
  (2, 'schema');

INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES
  (1, 1),
  (2, 2);
