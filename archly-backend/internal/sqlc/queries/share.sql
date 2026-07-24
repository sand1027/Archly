-- name: CreateShareLink :one
INSERT INTO share_links (slug, design_id, user_id, elements, app_state, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetShareLink :one
SELECT * FROM share_links
WHERE slug = $1 AND expires_at > NOW();

-- name: DeleteExpiredShareLinks :exec
DELETE FROM share_links WHERE expires_at < NOW();

-- name: GetCollabRoom :one
SELECT * FROM collab_rooms WHERE id = $1;

-- name: GetCollabRoomByDesign :one
SELECT * FROM collab_rooms WHERE design_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- name: CreateCollabRoom :one
INSERT INTO collab_rooms (design_id, elements, app_state)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateCollabRoom :one
UPDATE collab_rooms
SET elements = $2, app_state = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;
