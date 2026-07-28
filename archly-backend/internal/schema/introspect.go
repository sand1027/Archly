package schema

import (
	"context"
	"fmt"
	"strings"
)

// Introspect connects to the database and returns tables + foreign keys.
func Introspect(ctx context.Context, dbURL, schemaOverride string) (*Result, error) {
	parsed, err := ParseURL(dbURL, schemaOverride)
	if err != nil {
		return nil, err
	}

	switch parsed.Driver {
	case DriverPostgres:
		return introspectPostgres(ctx, parsed)
	case DriverMySQL:
		return introspectMySQL(ctx, parsed)
	case DriverSQLite:
		return introspectSQLite(ctx, parsed)
	case DriverMongo:
		return introspectMongo(ctx, parsed)
	default:
		return nil, fmt.Errorf("unsupported driver %q", parsed.Driver)
	}
}

func normalizeSQLType(driver Driver, dataType, udtName string) string {
	t := strings.ToLower(strings.TrimSpace(dataType))
	u := strings.ToLower(strings.TrimSpace(udtName))
	switch driver {
	case DriverPostgres:
		if u != "" && u != t {
			if u == "uuid" || strings.HasPrefix(u, "_") {
				return u
			}
			return u
		}
		if t == "character varying" {
			return "text"
		}
		if t == "timestamp with time zone" {
			return "timestamptz"
		}
		if t == "timestamp without time zone" {
			return "timestamp"
		}
		if t == "double precision" {
			return "float"
		}
		if t == "bigint" {
			return "bigint"
		}
		if t == "integer" || t == "smallint" {
			return "int"
		}
		if t == "boolean" {
			return "bool"
		}
		if t == "jsonb" || t == "json" {
			return "jsonb"
		}
		return t
	default:
		return t
	}
}

func labelFromFKColumn(col string) string {
	col = strings.TrimSuffix(col, "_id")
	col = strings.TrimSuffix(col, "Id")
	if col == "" {
		return "has"
	}
	return col
}
