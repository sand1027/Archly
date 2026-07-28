package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// StreamResult holds accumulated SSE output.
type StreamResult struct {
	Text     string
	Provider string
	Partial  bool
}

// TextToDiagramStream calls POST /v1/ai/text-to-diagram/chat-streaming.
func (c *Client) TextToDiagramStream(ctx context.Context, prompt, provider, mode string, onChunk func(string)) (*StreamResult, error) {
	body, err := json.Marshal(map[string]string{
		"prompt":   prompt,
		"provider": provider,
		"mode":     mode,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/v1/ai/text-to-diagram/chat-streaming", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	// SSE can run longer than default client timeout — use no timeout on transport.
	noTimeout := *c.HTTP
	noTimeout.Timeout = 0
	res, err := noTimeout.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		return nil, parseAPIError(res)
	}

	var buf strings.Builder
	scanner := bufio.NewScanner(res.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var eventLines []string

	flushEvent := func() error {
		if len(eventLines) == 0 {
			return nil
		}
		payload := strings.Join(eventLines, "\n")
		eventLines = nil
		if payload == "[DONE]" {
			return io.EOF
		}
		buf.WriteString(payload)
		if onChunk != nil {
			onChunk(payload)
		}
		return nil
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if err := flushEvent(); err == io.EOF {
				break
			} else if err != nil {
				return nil, err
			}
			continue
		}
		if strings.HasPrefix(line, "data: ") {
			eventLines = append(eventLines, strings.TrimPrefix(line, "data: "))
		}
	}
	if err := scanner.Err(); err != nil {
		text := buf.String()
		if text != "" {
			return &StreamResult{Text: text, Partial: true}, fmt.Errorf("stream read: %w", err)
		}
		return nil, err
	}
	_ = flushEvent()

	text := buf.String()
	return &StreamResult{Text: text, Provider: provider}, nil
}
