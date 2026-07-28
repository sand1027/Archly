package api

import (
	"context"
	"time"
)

type AuthUser struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	AvatarURL   *string   `json:"avatar_url"`
	Tier        string    `json:"tier"`
	CreatedAt   time.Time `json:"created_at"`
}

type AuthResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	User         AuthUser `json:"user"`
}

func (c *Client) Login(ctx context.Context, email, password string) (*AuthResponse, error) {
	var resp AuthResponse
	err := c.Post(ctx, "/auth/login", map[string]string{
		"email":    email,
		"password": password,
	}, &resp)
	if err != nil {
		return nil, err
	}
	c.token = resp.AccessToken
	c.refresh = resp.RefreshToken
	return &resp, nil
}

func (c *Client) Me(ctx context.Context) (*AuthUser, error) {
	var user AuthUser
	if err := c.Get(ctx, "/auth/me", &user); err != nil {
		return nil, err
	}
	return &user, nil
}

type HealthResponse struct {
	Status      string `json:"status"`
	Environment string `json:"environment"`
	Version     string `json:"version"`
}

func (c *Client) Health(ctx context.Context) (*HealthResponse, error) {
	var h HealthResponse
	if err := c.Get(ctx, "/health", &h); err != nil {
		return nil, err
	}
	return &h, nil
}
