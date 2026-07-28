package schema

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

func introspectSQLite(ctx context.Context, p *ParsedURL) (*Result, error) {
	dsn := p.DSN
	if !strings.HasPrefix(dsn, "file:") {
		dsn = "file:" + dsn + "?mode=ro"
	}

	db, err := sql.Open("sqlite", dsn)
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

	var fks []ForeignKey
	var tables []Table

	for _, tn := range tableNames {
		cols, err := loadSQLiteColumns(ctx, db, tn)
		if err != nil {
			return nil, err
		}
		tableFKs, err := loadSQLiteFKs(ctx, db, tn)
		if err != nil {
			return nil, err
		}
		fkByCol := map[string]ForeignKey{}
		for _, fk := range tableFKs {
			fkByCol[fk.ChildColumn] = fk
			fks = append(fks, fk)
		}
		for i := range cols {
			if fk, ok := fkByCol[cols[i].Name]; ok {
				cols[i].FK = &FKJSON{Table: fk.ParentTable, Column: fk.ParentColumn}
			}
		}
		tables = append(tables, Table{Name: tn, Columns: cols})
	}

	return &Result{
		Driver:   DriverSQLite,
		Schema:   "main",
		Database: p.Database,
		Tables:   tables,
		FKs:      fks,
	}, nil
}

func loadSQLiteColumns(ctx context.Context, db *sql.DB, table string) ([]Column, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%q)", table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []Column
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
			return nil, err
		}
		cols = append(cols, Column{
			Name:     name,
			Type:     strings.ToLower(colType),
			PK:       pk == 1,
			Nullable: notNull == 0,
		})
	}
	return cols, rows.Err()
}

func loadSQLiteFKs(ctx context.Context, db *sql.DB, table string) ([]ForeignKey, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA foreign_key_list(%q)", table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fks []ForeignKey
	for rows.Next() {
		var id, seq int
		var parentTable, fromCol, toCol string
		var onUpdate, onDelete, match string
		if err := rows.Scan(&id, &seq, &parentTable, &fromCol, &toCol, &onUpdate, &onDelete, &match); err != nil {
			return nil, err
		}
		fks = append(fks, ForeignKey{
			ChildTable:   table,
			ChildColumn:  fromCol,
			ParentTable:  parentTable,
			ParentColumn: toCol,
		})
	}
	return fks, rows.Err()
}
