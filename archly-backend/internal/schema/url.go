package schema

import (
	"fmt"
	"net/url"
	"strings"
)

// ParsedURL holds driver + DSN for database/sql.
type ParsedURL struct {
	Driver   Driver
	DSN      string
	Schema   string
	Database string
}

// ParseURL detects engine from a database URL.
func ParseURL(raw, schemaOverride string) (*ParsedURL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("database URL is required")
	}

	if !strings.Contains(raw, "://") {
		if strings.HasSuffix(strings.ToLower(raw), ".db") ||
			strings.HasSuffix(strings.ToLower(raw), ".sqlite") ||
			strings.HasSuffix(strings.ToLower(raw), ".sqlite3") {
			return &ParsedURL{
				Driver:   DriverSQLite,
				DSN:      raw,
				Schema:   "main",
				Database: raw,
			}, nil
		}
		return nil, fmt.Errorf("unrecognized database URL")
	}

	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("parse URL: %w", err)
	}

	switch strings.ToLower(u.Scheme) {
	case "postgres", "postgresql":
		schema := schemaOverride
		if schema == "" {
			schema = "public"
		}
		db := strings.TrimPrefix(u.Path, "/")
		return &ParsedURL{Driver: DriverPostgres, DSN: raw, Schema: schema, Database: db}, nil
	case "mysql", "mariadb":
		schema := schemaOverride
		if schema == "" {
			schema = strings.TrimPrefix(u.Path, "/")
		}
		return &ParsedURL{Driver: DriverMySQL, DSN: raw, Schema: schema, Database: schema}, nil
	case "sqlite", "file":
		path := strings.TrimPrefix(u.Path, "/")
		if path == "" {
			path = u.Host
		}
		return &ParsedURL{Driver: DriverSQLite, DSN: path, Schema: "main", Database: path}, nil
	case "mongodb", "mongodb+srv":
		db := schemaOverride
		if db == "" {
			db = strings.TrimPrefix(u.Path, "/")
		}
		if db == "" {
			db = u.Query().Get("authSource")
		}
		if db == "" {
			return nil, fmt.Errorf("database name is required — select a database or include it in the URL path")
		}
		return &ParsedURL{Driver: DriverMongo, DSN: raw, Schema: db, Database: db}, nil
	default:
		return nil, fmt.Errorf("unsupported scheme %q (use postgres, mysql, sqlite, or mongodb)", u.Scheme)
	}
}

// RedactedURL hides password for logs.
func RedactedURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "[invalid-url]"
	}
	if u.User != nil {
		if _, ok := u.User.Password(); ok {
			u.User = url.UserPassword(u.User.Username(), "****")
		}
	}
	return u.String()
}
