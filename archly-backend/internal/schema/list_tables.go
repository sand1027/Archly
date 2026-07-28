package schema

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ListTablesResult is returned by POST /v1/schema/tables.
type ListTablesResult struct {
	Driver Driver   `json:"driver"`
	Schema string   `json:"schema"`
	Tables []string `json:"tables"`
}

// IntrospectInput configures a schema introspection run.
type IntrospectInput struct {
	URL      string
	Database string
	Schema   string
	Tables   []string
}

// IntrospectWithInput connects and returns tables + foreign keys.
func IntrospectWithInput(ctx context.Context, in IntrospectInput) (*Result, error) {
	resolvedURL, schemaOverride, err := ResolveIntrospectURL(in.URL, in.Database, in.Schema)
	if err != nil {
		return nil, err
	}

	res, err := Introspect(ctx, resolvedURL, schemaOverride)
	if err != nil {
		return nil, err
	}

	if len(in.Tables) > 0 {
		res = filterResultTables(res, in.Tables)
	}
	return res, nil
}

func filterResultTables(res *Result, names []string) *Result {
	want := map[string]bool{}
	for _, n := range names {
		want[strings.ToLower(strings.TrimSpace(n))] = true
	}

	tableSet := map[string]bool{}
	var tables []Table
	for _, t := range res.Tables {
		if want[strings.ToLower(t.Name)] {
			tables = append(tables, t)
			tableSet[strings.ToLower(t.Name)] = true
		}
	}

	var fks []ForeignKey
	for _, fk := range res.FKs {
		if tableSet[strings.ToLower(fk.ChildTable)] && tableSet[strings.ToLower(fk.ParentTable)] {
			fks = append(fks, fk)
		}
	}

	out := *res
	out.Tables = tables
	out.FKs = fks
	return &out
}

// ListTables returns table/collection names without sampling document data.
func ListTables(ctx context.Context, raw, database, schemaOverride string) (*ListTablesResult, error) {
	resolvedURL, schema, err := ResolveIntrospectURL(raw, database, schemaOverride)
	if err != nil {
		return nil, err
	}

	parsed, err := ParseURL(resolvedURL, schema)
	if err != nil {
		return nil, err
	}

	var tables []string
	switch parsed.Driver {
	case DriverPostgres:
		tables, err = listPostgresTables(ctx, parsed)
	case DriverMySQL:
		tables, err = listMySQLTables(ctx, parsed)
	case DriverSQLite:
		tables, err = listSQLiteTables(ctx, parsed)
	case DriverMongo:
		tables, err = listMongoTableNames(ctx, parsed)
	default:
		return nil, fmt.Errorf("unsupported driver %q", parsed.Driver)
	}
	if err != nil {
		return nil, err
	}

	sort.Strings(tables)
	return &ListTablesResult{
		Driver: parsed.Driver,
		Schema: parsed.Schema,
		Tables: tables,
	}, nil
}

func listPostgresTables(ctx context.Context, p *ParsedURL) ([]string, error) {
	db, err := sql.Open("pgx", p.DSN)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	rows, err := db.QueryContext(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = $1 AND table_type = 'BASE TABLE'
		ORDER BY table_name`, p.Schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanNames(rows)
}

func listMySQLTables(ctx context.Context, p *ParsedURL) ([]string, error) {
	dsn, err := mysqlDSNFromURL(p.DSN)
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

	schema := p.Schema
	if schema == "" {
		return nil, fmt.Errorf("mysql database name is required")
	}

	rows, err := db.QueryContext(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = ? AND table_type = 'BASE TABLE'
		ORDER BY table_name`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanNames(rows)
}

func listSQLiteTables(ctx context.Context, p *ParsedURL) ([]string, error) {
	db, err := sql.Open("sqlite", p.DSN)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("connect sqlite: %w", err)
	}

	rows, err := db.QueryContext(ctx, `
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
		ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanNames(rows)
}

func listMongoTableNames(ctx context.Context, p *ParsedURL) ([]string, error) {
	clientOpts := options.Client().ApplyURI(p.DSN)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("connect mongodb: %w", err)
	}
	defer client.Disconnect(context.Background())

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("ping mongodb: %w", err)
	}

	collections, _, err := listMongoCollections(ctx, client.Database(p.Database))
	return collections, err
}

func scanNames(rows *sql.Rows) ([]string, error) {
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// listMongoCollections is shared with mongodb introspect (views skipped).
func listMongoCollections(ctx context.Context, db *mongo.Database) ([]string, int, error) {
	cur, err := db.ListCollections(ctx, bson.M{})
	if err != nil {
		return nil, 0, fmt.Errorf("list collections: %w", err)
	}
	defer cur.Close(ctx)

	var collections []string
	skippedViews := 0
	for cur.Next(ctx) {
		var info struct {
			Name string `bson:"name"`
			Type string `bson:"type"`
		}
		if err := cur.Decode(&info); err != nil {
			continue
		}
		if strings.HasPrefix(info.Name, "system.") {
			continue
		}
		if info.Type == "view" {
			skippedViews++
			continue
		}
		collections = append(collections, info.Name)
	}
	if err := cur.Err(); err != nil {
		return nil, 0, err
	}
	return collections, skippedViews, nil
}
