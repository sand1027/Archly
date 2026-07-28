package schema

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ListDatabasesResult is returned by POST /v1/schema/databases.
type ListDatabasesResult struct {
	Driver    Driver   `json:"driver"`
	Databases []string `json:"databases"`
	Default   string   `json:"default,omitempty"`
}

// ListDatabases connects with a URL and returns selectable databases.
func ListDatabases(ctx context.Context, raw string) (*ListDatabasesResult, error) {
	parsed, err := ParseConnectionURL(raw)
	if err != nil {
		return nil, err
	}

	defaultDB := databaseFromPath(raw)

	switch parsed.Driver {
	case DriverMongo:
		dbs, err := listMongoDatabases(ctx, parsed.DSN)
		if err != nil {
			return nil, err
		}
		return &ListDatabasesResult{Driver: DriverMongo, Databases: dbs, Default: defaultDB}, nil
	case DriverPostgres:
		dbs, err := listPostgresDatabases(ctx, parsed.DSN)
		if err != nil {
			return nil, err
		}
		return &ListDatabasesResult{Driver: DriverPostgres, Databases: dbs, Default: defaultDB}, nil
	case DriverMySQL:
		dbs, err := listMySQLDatabases(ctx, parsed.DSN)
		if err != nil {
			return nil, err
		}
		return &ListDatabasesResult{Driver: DriverMySQL, Databases: dbs, Default: defaultDB}, nil
	case DriverSQLite:
		name := parsed.Database
		if name == "" {
			name = "main"
		}
		return &ListDatabasesResult{Driver: DriverSQLite, Databases: []string{name}, Default: name}, nil
	default:
		return nil, fmt.Errorf("unsupported driver %q", parsed.Driver)
	}
}

func listMongoDatabases(ctx context.Context, uri string) ([]string, error) {
	fallbackDB := databaseFromPath(uri)

	clientOpts := options.Client().
		ApplyURI(uri).
		SetConnectTimeout(15 * time.Second).
		SetServerSelectionTimeout(20 * time.Second).
		SetSocketTimeout(25 * time.Second)

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		if fallbackDB != "" {
			return []string{fallbackDB}, nil
		}
		return nil, fmt.Errorf("connect mongodb: %w", err)
	}
	defer client.Disconnect(context.Background())

	pingCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		if fallbackDB != "" {
			return []string{fallbackDB}, nil
		}
		return nil, fmt.Errorf("ping mongodb: %w", err)
	}

	listCtx, listCancel := context.WithTimeout(ctx, 20*time.Second)
	defer listCancel()

	names, err := mongoDatabaseNames(listCtx, client)
	if err != nil {
		// Atlas users scoped to one DB often cannot listDatabases — fall back to URL path.
		if db := databaseFromPath(uri); db != "" {
			return []string{db}, nil
		}
		return nil, fmt.Errorf("list mongodb databases: %w", err)
	}

	skip := map[string]bool{"admin": true, "local": true, "config": true}
	var out []string
	for _, n := range names {
		if skip[n] {
			continue
		}
		out = append(out, n)
	}
	sort.Strings(out)

	if len(out) == 0 {
		if db := databaseFromPath(uri); db != "" {
			return []string{db}, nil
		}
	}
	return out, nil
}

func mongoDatabaseNames(ctx context.Context, client *mongo.Client) ([]string, error) {
	result, err := client.ListDatabases(ctx, bson.M{})
	if err == nil && len(result.Databases) > 0 {
		names := make([]string, 0, len(result.Databases))
		for _, db := range result.Databases {
			if db.Name != "" {
				names = append(names, db.Name)
			}
		}
		if len(names) > 0 {
			return names, nil
		}
	}

	// Fallback — must pass bson.M{}, not nil (Atlas returns "document is nil").
	return client.ListDatabaseNames(ctx, bson.M{})
}

func listPostgresDatabases(ctx context.Context, raw string) ([]string, error) {
	dsn, err := postgresListDSN(raw)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	rows, err := db.QueryContext(ctx, `
		SELECT datname
		FROM pg_database
		WHERE datistemplate = false AND datallowconn = true
		ORDER BY datname`)
	if err != nil {
		return nil, fmt.Errorf("list postgres databases: %w", err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func listMySQLDatabases(ctx context.Context, raw string) ([]string, error) {
	dsn, err := mysqlDSNFromURL(raw)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("connect mysql: %w", err)
	}

	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
	if err != nil {
		return nil, fmt.Errorf("list mysql databases: %w", err)
	}
	defer rows.Close()

	skip := map[string]bool{
		"information_schema": true,
		"performance_schema": true,
		"mysql":              true,
		"sys":                true,
	}

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		if skip[strings.ToLower(name)] {
			continue
		}
		out = append(out, name)
	}
	sort.Strings(out)
	return out, rows.Err()
}

func postgresListDSN(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	if strings.TrimPrefix(u.Path, "/") == "" {
		u.Path = "/postgres"
	}
	return u.String(), nil
}

func databaseFromPath(raw string) string {
	raw = strings.TrimSpace(raw)
	if !strings.Contains(raw, "://") {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(u.Path, "/")
}

// ResolveIntrospectURL merges an optional selected database into the connection URL.
func ResolveIntrospectURL(raw, database, schemaOverride string) (string, string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", fmt.Errorf("database URL is required")
	}

	db := strings.TrimSpace(database)
	if db != "" {
		var err error
		raw, err = WithDatabasePath(raw, db)
		if err != nil {
			return "", "", err
		}
	}

	return raw, schemaOverride, nil
}

// WithDatabasePath sets the database name on a connection URL path.
func WithDatabasePath(raw, database string) (string, error) {
	database = strings.TrimSpace(database)
	if database == "" {
		return raw, nil
	}
	if !strings.Contains(raw, "://") {
		return raw, nil
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("parse URL: %w", err)
	}
	u.Path = "/" + strings.TrimPrefix(database, "/")
	return u.String(), nil
}

// ParseConnectionURL parses a URL for listing databases (database name optional).
func ParseConnectionURL(raw string) (*ParsedURL, error) {
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
		db := strings.TrimPrefix(u.Path, "/")
		dsn := raw
		if db == "" {
			dsn, err = postgresListDSN(raw)
			if err != nil {
				return nil, err
			}
		}
		return &ParsedURL{Driver: DriverPostgres, DSN: dsn, Schema: "public", Database: db}, nil
	case "mysql", "mariadb":
		db := strings.TrimPrefix(u.Path, "/")
		return &ParsedURL{Driver: DriverMySQL, DSN: raw, Schema: db, Database: db}, nil
	case "sqlite", "file":
		path := strings.TrimPrefix(u.Path, "/")
		if path == "" {
			path = u.Host
		}
		return &ParsedURL{Driver: DriverSQLite, DSN: path, Schema: "main", Database: path}, nil
	case "mongodb", "mongodb+srv":
		db := strings.TrimPrefix(u.Path, "/")
		if db == "" {
			db = u.Query().Get("authSource")
		}
		return &ParsedURL{Driver: DriverMongo, DSN: raw, Schema: db, Database: db}, nil
	default:
		return nil, fmt.Errorf("unsupported scheme %q (use postgres, mysql, sqlite, or mongodb)", u.Scheme)
	}
}
