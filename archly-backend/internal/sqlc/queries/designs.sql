-- name: CreateDesign :one
INSERT INTO designs (user_id, title, description, elements, app_state, tags)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetDesignByID :one
SELECT * FROM designs WHERE id = $1;

-- name: ListPublishedDesigns :many
SELECT * FROM designs
WHERE published = TRUE
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListPublishedDesignsByTag :many
SELECT * FROM designs
WHERE published = TRUE AND $1 = ANY(tags)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPublishedDesigns :one
SELECT COUNT(*) FROM designs WHERE published = TRUE;

-- name: CountPublishedDesignsByTag :one
SELECT COUNT(*) FROM designs
WHERE published = TRUE AND $1 = ANY(tags);

-- name: UpdateDesign :one
UPDATE designs
SET title = $2,
    description = $3,
    elements = $4,
    app_state = $5,
    tags = $6,
    updated_at = NOW()
WHERE id = $1 AND user_id = $7
RETURNING *;

-- name: PublishDesign :one
UPDATE designs SET published = TRUE, updated_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteDesign :exec
DELETE FROM designs WHERE id = $1 AND user_id = $2;

-- name: IncrementForkCount :exec
UPDATE designs SET fork_count = fork_count + 1, updated_at = NOW()
WHERE id = $1;

-- name: IncrementStarCount :exec
UPDATE designs SET star_count = star_count + 1, updated_at = NOW()
WHERE id = $1;

-- name: DecrementStarCount :exec
UPDATE designs SET star_count = GREATEST(0, star_count - 1), updated_at = NOW()
WHERE id = $1;

-- name: IncrementViewCount :exec
UPDATE designs SET view_count = view_count + 1, updated_at = NOW()
WHERE id = $1;

-- name: CreateDesignFork :one
INSERT INTO design_forks (original_id, fork_id, user_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: IsDesignStarred :one
SELECT EXISTS(
    SELECT 1 FROM design_stars
    WHERE design_id = $1 AND user_id = $2
) AS starred;

-- name: StarDesign :exec
INSERT INTO design_stars (design_id, user_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnstarDesign :exec
DELETE FROM design_stars WHERE design_id = $1 AND user_id = $2;
