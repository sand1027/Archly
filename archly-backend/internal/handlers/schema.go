package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/archly/api/internal/schema"
)

type SchemaHandler struct{}

func NewSchemaHandler() *SchemaHandler {
	return &SchemaHandler{}
}

// POST /v1/schema/databases
// Lists databases for a connection URL so the client can offer a picker.
// Body: { "url": "mongodb+srv://…" } — database name in path is optional.
func (h *SchemaHandler) ListDatabases(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL string `json:"url"`
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.URL == "" {
		BadRequest(w, "url is required")
		return
	}

	log.Info().Str("url", schema.RedactedURL(body.URL)).Msg("schema: list databases")

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	res, err := schema.ListDatabases(ctx, body.URL)
	if err != nil {
		log.Warn().Err(err).Str("url", schema.RedactedURL(body.URL)).Msg("schema: list databases failed")
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			Error(w, http.StatusGatewayTimeout, "LIST_DATABASES_TIMEOUT", "connection timed out while listing databases")
			return
		}
		Error(w, http.StatusBadRequest, "LIST_DATABASES_FAILED", err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]any{
		"driver":    string(res.Driver),
		"databases": res.Databases,
		"default":   res.Default,
	})
}

// POST /v1/schema/introspect
// Reads a live database schema and returns Archly Schema mode nodes/edges.
// Body: { "url": "postgresql://… | mysql://… | sqlite://…", "schema": optional override }
// Engine is detected from the URL scheme — not from a separate db type field.
// The URL is never stored or logged with credentials.
func (h *SchemaHandler) Introspect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL      string   `json:"url"`
		Database string   `json:"database"`
		Schema   string   `json:"schema"`
		Tables   []string `json:"tables"`
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.URL == "" {
		BadRequest(w, "url is required")
		return
	}

	resolvedURL, schemaOverride, err := schema.ResolveIntrospectURL(body.URL, body.Database, body.Schema)
	if err != nil {
		BadRequest(w, err.Error())
		return
	}

	parsed, err := schema.ParseURL(resolvedURL, schemaOverride)
	if err == nil {
		log.Info().
			Str("url", schema.RedactedURL(resolvedURL)).
			Str("driver", string(parsed.Driver)).
			Str("schema", parsed.Schema).
			Msg("schema: introspect request")
	} else {
		log.Info().
			Str("url", schema.RedactedURL(resolvedURL)).
			Msg("schema: introspect request")
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()

	res, err := schema.IntrospectWithInput(ctx, schema.IntrospectInput{
		URL:      body.URL,
		Database: body.Database,
		Schema:   body.Schema,
		Tables:   body.Tables,
	})
	if err != nil {
		log.Warn().Err(err).Str("url", schema.RedactedURL(body.URL)).Msg("schema: introspect failed")
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			Error(w, http.StatusGatewayTimeout, "INTROSPECT_TIMEOUT", "database introspection timed out — try again or use a smaller database")
			return
		}
		Error(w, http.StatusBadRequest, "INTROSPECT_FAILED", err.Error())
		return
	}

	if len(res.Tables) == 0 {
		Error(w, http.StatusNotFound, "NO_TABLES", "no tables found in the specified schema")
		return
	}

	JSON(w, http.StatusOK, schema.ToResponse(res))
}

// POST /v1/schema/tables
// Lists tables/collections in a database (no document sampling).
func (h *SchemaHandler) ListTables(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL      string `json:"url"`
		Database string `json:"database"`
		Schema   string `json:"schema"`
	}
	if !Decode(w, r, &body) {
		return
	}
	if body.URL == "" {
		BadRequest(w, "url is required")
		return
	}

	log.Info().Str("url", schema.RedactedURL(body.URL)).Msg("schema: list tables")

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	res, err := schema.ListTables(ctx, body.URL, body.Database, body.Schema)
	if err != nil {
		log.Warn().Err(err).Str("url", schema.RedactedURL(body.URL)).Msg("schema: list tables failed")
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			Error(w, http.StatusGatewayTimeout, "LIST_TABLES_TIMEOUT", "connection timed out while listing tables")
			return
		}
		Error(w, http.StatusBadRequest, "LIST_TABLES_FAILED", err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]any{
		"driver": string(res.Driver),
		"schema": res.Schema,
		"tables": res.Tables,
	})
}
