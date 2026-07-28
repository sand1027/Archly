package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sand1027/Archly/archly-cli/internal/auth"
)

const defaultTimeout = 120 * time.Second

// Client talks to the Archly HTTP API.
type Client struct {
	BaseURL string
	HTTP    *http.Client
	token   string
	refresh string
	onToken func(access, refresh string)
}

type APIError struct {
	Status  int
	Code    string
	Message string
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("%s (%s)", e.Message, e.Code)
	}
	return e.Message
}

func New(baseURL string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

func (c *Client) WithCredentials(cred *auth.Credentials) *Client {
	if cred == nil {
		return c
	}
	c.token = cred.AccessToken
	c.refresh = cred.RefreshToken
	return c
}

func (c *Client) OnTokenUpdate(fn func(access, refresh string)) *Client {
	c.onToken = fn
	return c
}

func (c *Client) DoJSON(ctx context.Context, method, path string, body any, out any) error {
	return c.doJSON(ctx, method, path, body, out, true)
}

func (c *Client) doJSON(ctx context.Context, method, path string, body any, out any, retry bool) error {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, r)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusUnauthorized && retry && c.refresh != "" {
		if err := c.refreshToken(ctx); err == nil {
			return c.doJSON(ctx, method, path, body, out, false)
		}
	}

	if res.StatusCode >= 400 {
		return parseAPIError(res)
	}
	if out == nil || res.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func parseAPIError(res *http.Response) error {
 ae := &APIError{Status: res.StatusCode, Message: res.Status}
	var body struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err == nil {
		if body.Message != "" {
			ae.Message = body.Message
		}
		if body.Code != "" {
			ae.Code = body.Code
		}
	}
	return ae
}

func (c *Client) refreshToken(ctx context.Context) error {
	var resp AuthResponse
	err := c.doJSON(ctx, http.MethodPost, "/auth/refresh", map[string]string{
		"refresh_token": c.refresh,
	}, &resp, false)
	if err != nil {
		return err
	}
	c.token = resp.AccessToken
	if resp.RefreshToken != "" {
		c.refresh = resp.RefreshToken
	}
	if c.onToken != nil {
		c.onToken(c.token, c.refresh)
	}
	return nil
}

func (c *Client) Get(ctx context.Context, path string, out any) error {
	return c.DoJSON(ctx, http.MethodGet, path, nil, out)
}

func (c *Client) Post(ctx context.Context, path string, body, out any) error {
	return c.DoJSON(ctx, http.MethodPost, path, body, out)
}

func (c *Client) Patch(ctx context.Context, path string, body, out any) error {
	return c.DoJSON(ctx, http.MethodPatch, path, body, out)
}

func (c *Client) Delete(ctx context.Context, path string) error {
	return c.DoJSON(ctx, http.MethodDelete, path, nil, nil)
}
