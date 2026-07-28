package schema

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	"github.com/go-sql-driver/mysql"
)

func introspectMySQL(ctx context.Context, p *ParsedURL) (*Result, error) {
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
		return nil, fmt.Errorf("mysql database name is required in URL path")
	}

	rows, err := db.QueryContext(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = ? AND table_type = 'BASE TABLE'
		ORDER BY table_name`, schema)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	defer rows.Close()

	var tableNames []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tableNames = append(tableNames, name)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	pkMap, err := loadMySQLKeys(ctx, db, schema, "PRIMARY KEY")
	if err != nil {
		return nil, err
	}
	uniqueMap, err := loadMySQLKeys(ctx, db, schema, "UNIQUE")
	if err != nil {
		return nil, err
	}
	fks, err := loadMySQLFKs(ctx, db, schema)
	if err != nil {
		return nil, err
	}
	fkByChild := map[string]map[string]ForeignKey{}
	for _, fk := range fks {
		if fkByChild[fk.ChildTable] == nil {
			fkByChild[fk.ChildTable] = map[string]ForeignKey{}
		}
		fkByChild[fk.ChildTable][fk.ChildColumn] = fk
	}

	var tables []Table
	for _, tn := range tableNames {
		cols, err := loadMySQLColumns(ctx, db, schema, tn)
		if err != nil {
			return nil, err
		}
		pks := pkMap[tn]
		uniques := uniqueMap[tn]
		for i := range cols {
			name := cols[i].Name
			cols[i].PK = pks[name]
			cols[i].Unique = uniques[name] && !cols[i].PK
			if fk, ok := fkByChild[tn][name]; ok {
				cols[i].FK = &FKJSON{Table: fk.ParentTable, Column: fk.ParentColumn}
			}
		}
		tables = append(tables, Table{Name: tn, Columns: cols})
	}

	return &Result{
		Driver:   DriverMySQL,
		Schema:   schema,
		Database: schema,
		Tables:   tables,
		FKs:      fks,
	}, nil
}

func mysqlDSNFromURL(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	pass, _ := u.User.Password()
	cfg := mysql.Config{
		User:                 u.User.Username(),
		Passwd:               pass,
		Net:                  "tcp",
		Addr:                 u.Host,
		DBName:               strings.TrimPrefix(u.Path, "/"),
		ParseTime:            true,
		AllowNativePasswords: true,
	}
	if cfg.Addr == "" {
		cfg.Addr = "127.0.0.1:3306"
	}
	return cfg.FormatDSN(), nil
}

func loadMySQLColumns(ctx context.Context, db *sql.DB, schema, table string) ([]Column, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT column_name, data_type, is_nullable
		FROM information_schema.columns
		WHERE table_schema = ? AND table_name = ?
		ORDER BY ordinal_position`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []Column
	for rows.Next() {
		var name, dataType, nullable string
		if err := rows.Scan(&name, &dataType, &nullable); err != nil {
			return nil, err
		}
		cols = append(cols, Column{
			Name:     name,
			Type:     normalizeSQLType(DriverMySQL, dataType, dataType),
			Nullable: nullable == "YES",
		})
	}
	return cols, rows.Err()
}

func loadMySQLKeys(ctx context.Context, db *sql.DB, schema, constraintType string) (map[string]map[string]bool, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tc.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.table_schema = kcu.table_schema
		WHERE tc.table_schema = ? AND tc.constraint_type = ?`, schema, constraintType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]map[string]bool{}
	for rows.Next() {
		var table, col string
		if err := rows.Scan(&table, &col); err != nil {
			return nil, err
		}
		if out[table] == nil {
			out[table] = map[string]bool{}
		}
		out[table][col] = true
	}
	return out, rows.Err()
}

func loadMySQLFKs(ctx context.Context, db *sql.DB, schema string) ([]ForeignKey, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT
		  kcu.table_name,
		  kcu.column_name,
		  kcu.referenced_table_name,
		  kcu.referenced_column_name
		FROM information_schema.key_column_usage kcu
		WHERE kcu.table_schema = ?
		  AND kcu.referenced_table_name IS NOT NULL`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fks []ForeignKey
	for rows.Next() {
		var fk ForeignKey
		if err := rows.Scan(&fk.ChildTable, &fk.ChildColumn, &fk.ParentTable, &fk.ParentColumn); err != nil {
			return nil, err
		}
		fks = append(fks, fk)
	}
	return fks, rows.Err()
}
