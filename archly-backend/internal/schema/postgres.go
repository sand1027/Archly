package schema

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func introspectPostgres(ctx context.Context, p *ParsedURL) (*Result, error) {
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

	pkMap, err := loadPostgresKeys(ctx, db, p.Schema, "PRIMARY KEY")
	if err != nil {
		return nil, err
	}
	uniqueMap, err := loadPostgresKeys(ctx, db, p.Schema, "UNIQUE")
	if err != nil {
		return nil, err
	}

	fks, err := loadPostgresFKs(ctx, db, p.Schema)
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
		cols, err := loadPostgresColumns(ctx, db, p.Schema, tn)
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
		Driver:   DriverPostgres,
		Schema:   p.Schema,
		Database: p.Database,
		Tables:   tables,
		FKs:      fks,
	}, nil
}

func loadPostgresColumns(ctx context.Context, db *sql.DB, schema, table string) ([]Column, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT column_name, data_type, udt_name, is_nullable
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []Column
	for rows.Next() {
		var name, dataType, udt, nullable string
		if err := rows.Scan(&name, &dataType, &udt, &nullable); err != nil {
			return nil, err
		}
		cols = append(cols, Column{
			Name:     name,
			Type:     normalizeSQLType(DriverPostgres, dataType, udt),
			Nullable: nullable == "YES",
		})
	}
	return cols, rows.Err()
}

func loadPostgresKeys(ctx context.Context, db *sql.DB, schema, constraintType string) (map[string]map[string]bool, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tc.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.table_schema = kcu.table_schema
		WHERE tc.table_schema = $1 AND tc.constraint_type = $2`, schema, constraintType)
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

func loadPostgresFKs(ctx context.Context, db *sql.DB, schema string) ([]ForeignKey, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT
		  kcu.table_name,
		  kcu.column_name,
		  ccu.table_name,
		  ccu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage ccu
		  ON ccu.constraint_name = tc.constraint_name
		 AND ccu.table_schema = tc.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`, schema)
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
