package api

import (
	"context"
	"encoding/json"
	"fmt"
)

type DiagramToCodeResponse struct {
	Code   string `json:"code"`
	Format string `json:"format"`
}

// DiagramToCode calls POST /v1/ai/diagram-to-code/generate.
// Until B1 (mermaid-to-code) ships, we send a small JSON wrapper the LLM can read.
func (c *Client) DiagramToCode(ctx context.Context, mermaid, format string) (*DiagramToCodeResponse, error) {
	if format == "" {
		format = "docker-compose"
	}
	payload, err := json.Marshal(map[string]string{
		"format":  "mermaid",
		"mermaid": mermaid,
		"note":    "CLI export — interpret as Mermaid architecture diagram, not Excalidraw JSON",
	})
	if err != nil {
		return nil, err
	}
	var resp DiagramToCodeResponse
	err = c.Post(ctx, "/v1/ai/diagram-to-code/generate", map[string]any{
		"elements": json.RawMessage(payload),
		"format":   format,
	}, &resp)
	if err != nil {
		return nil, err
	}
	if resp.Code == "" {
		return nil, fmt.Errorf("empty code in response")
	}
	return &resp, nil
}
