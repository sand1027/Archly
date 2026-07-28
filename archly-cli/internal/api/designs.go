package api

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type Design struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Elements    json.RawMessage `json:"elements"`
	AppState    json.RawMessage `json:"app_state"`
	Tags        []string        `json:"tags"`
	Kind        string          `json:"kind"`
	Published   bool            `json:"published"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type DesignsListResponse struct {
	Designs  []Design `json:"designs"`
	Total    int64    `json:"total"`
	Page     int32    `json:"page"`
	PageSize int32    `json:"page_size"`
}

type SaveDesignRequest struct {
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	Tags        []string        `json:"tags,omitempty"`
	Kind        string          `json:"kind"`
	Elements    json.RawMessage `json:"elements"`
	AppState    json.RawMessage `json:"app_state"`
}

func (c *Client) ListMine(ctx context.Context, page, pageSize int) (*DesignsListResponse, error) {
	path := fmt.Sprintf("/designs/mine?page=%d&pageSize=%d", page, pageSize)
	var resp DesignsListResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) GetDesign(ctx context.Context, id string) (*Design, error) {
	var d Design
	if err := c.Get(ctx, "/designs/"+id, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func (c *Client) SaveDesign(ctx context.Context, req SaveDesignRequest) (*Design, error) {
	var d Design
	if err := c.Post(ctx, "/designs", req, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func (c *Client) DeleteDesign(ctx context.Context, id string) error {
	return c.Delete(ctx, "/designs/"+id)
}

// ExtractMermaid pulls Mermaid source from a saved design (CLI shim: app_state.mermaid).
func ExtractMermaid(d *Design) (string, error) {
	if len(d.AppState) > 0 {
		var st struct {
			Mermaid string `json:"mermaid"`
		}
		if err := json.Unmarshal(d.AppState, &st); err == nil && st.Mermaid != "" {
			return st.Mermaid, nil
		}
	}
	return "", fmt.Errorf("design %s has no mermaid in app_state (save via CLI or re-export from web)", d.ID)
}

func MermaidSavePayload(mermaid, kind string) (SaveDesignRequest, error) {
	if kind == "" {
		kind = "flow"
	}
	elements, err := json.Marshal(map[string]any{
		"nodes": []any{},
		"edges": []any{},
	})
	if err != nil {
		return SaveDesignRequest{}, err
	}
	appState, err := json.Marshal(map[string]string{
		"mermaid":  mermaid,
		"source":   "archly-cli",
		"cli_version": "0.1.0",
	})
	if err != nil {
		return SaveDesignRequest{}, err
	}
	return SaveDesignRequest{
		Kind:     kind,
		Elements: elements,
		AppState: appState,
		Tags:     []string{"cli"},
	}, nil
}
