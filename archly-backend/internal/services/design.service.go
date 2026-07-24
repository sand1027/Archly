package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/archly/api/internal/kafka"
	"github.com/archly/api/internal/kafka/topics"
	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

var ErrDesignNotFound = errors.New("design not found")
var ErrForbidden = errors.New("forbidden")

type DesignService struct {
	q        *sqlcgen.Queries
	pool     *pgxpool.Pool
	producer kafka.Producer
}

func NewDesignService(pool *pgxpool.Pool, producer kafka.Producer) *DesignService {
	return &DesignService{q: sqlcgen.NewFromPool(pool), pool: pool, producer: producer}
}

type ListDesignsResult struct {
	Designs []sqlcgen.Design `json:"designs"`
	Total   int64            `json:"total"`
	Page    int32            `json:"page"`
	PageSize int32           `json:"page_size"`
}

func (s *DesignService) List(ctx context.Context, tag string, page, pageSize int32) (*ListDesignsResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 24
	}
	offset := (page - 1) * pageSize

	var designs []sqlcgen.Design
	var total int64
	var err error

	if tag != "" {
		designs, err = s.q.ListPublishedDesignsByTag(ctx, tag, pageSize, offset)
		if err != nil {
			return nil, err
		}
		// For tag queries use a reasonable count estimate
		total = int64(len(designs))
	} else {
		designs, err = s.q.ListPublishedDesigns(ctx, pageSize, offset)
		if err != nil {
			return nil, err
		}
		total, err = s.q.CountPublishedDesigns(ctx)
		if err != nil {
			return nil, err
		}
	}

	if designs == nil {
		designs = []sqlcgen.Design{}
	}

	return &ListDesignsResult{
		Designs:  designs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *DesignService) Get(ctx context.Context, id uuid.UUID) (sqlcgen.Design, error) {
	d, err := s.q.GetDesignByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return d, ErrDesignNotFound
	}
	return d, err
}

func (s *DesignService) Create(ctx context.Context, userID uuid.UUID, title, description string, elements, appState json.RawMessage, tags []string, publish bool) (sqlcgen.Design, error) {
	d, err := s.q.CreateDesign(ctx, userID, title, description, elements, appState, tags)
	if err != nil {
		return d, fmt.Errorf("create design: %w", err)
	}
	if publish {
		d, err = s.q.PublishDesign(ctx, d.ID, userID)
		if err != nil {
			return d, err
		}
		_ = s.producer.Publish(topics.DesignPublished, d.ID.String(), map[string]any{"design_id": d.ID, "user_id": userID})
	}
	return d, nil
}

func (s *DesignService) Update(ctx context.Context, id, userID uuid.UUID, title, description string, elements, appState json.RawMessage, tags []string) (sqlcgen.Design, error) {
	d, err := s.q.UpdateDesign(ctx, id, userID, title, description, elements, appState, tags)
	if errors.Is(err, pgx.ErrNoRows) {
		return d, ErrForbidden
	}
	return d, err
}

func (s *DesignService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.q.DeleteDesign(ctx, id, userID)
}

func (s *DesignService) Fork(ctx context.Context, originalID, userID uuid.UUID) (sqlcgen.Design, error) {
	original, err := s.q.GetDesignByID(ctx, originalID)
	if errors.Is(err, pgx.ErrNoRows) {
		return sqlcgen.Design{}, ErrDesignNotFound
	}
	if err != nil {
		return sqlcgen.Design{}, err
	}

	forked, err := s.q.CreateDesign(ctx, userID,
		"Fork of "+original.Title, original.Description,
		original.Elements, original.AppState, original.Tags)
	if err != nil {
		return forked, fmt.Errorf("create fork: %w", err)
	}

	_, _ = s.q.CreateDesignFork(ctx, originalID, forked.ID, userID)
	_ = s.q.IncrementForkCount(ctx, originalID)
	_ = s.producer.Publish(topics.DesignForked, originalID.String(), map[string]any{
		"original_id": originalID, "fork_id": forked.ID, "user_id": userID,
	})

	return forked, nil
}

func (s *DesignService) Star(ctx context.Context, designID, userID uuid.UUID) (bool, error) {
	starred, err := s.q.IsDesignStarred(ctx, designID, userID)
	if err != nil {
		return false, err
	}
	if starred {
		_ = s.q.UnstarDesign(ctx, designID, userID)
		_ = s.q.DecrementStarCount(ctx, designID)
		return false, nil
	}
	_ = s.q.StarDesign(ctx, designID, userID)
	_ = s.q.IncrementStarCount(ctx, designID)
	return true, nil
}
