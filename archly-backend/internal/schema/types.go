package schema

// Driver identifies the database engine.
type Driver string

const (
	DriverPostgres Driver = "postgres"
	DriverMySQL    Driver = "mysql"
	DriverSQLite   Driver = "sqlite"
	DriverMongo    Driver = "mongodb"
)

// Column from live introspection.
type Column struct {
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	PK       bool    `json:"pk,omitempty"`
	Unique   bool    `json:"unique,omitempty"`
	Nullable bool    `json:"nullable,omitempty"`
	FK       *FKJSON `json:"fk,omitempty"`
}

type FKJSON struct {
	Table  string `json:"table"`
	Column string `json:"column"`
}

// Table metadata.
type Table struct {
	Name    string
	Columns []Column
}

// ForeignKey child → parent.
type ForeignKey struct {
	ChildTable   string
	ChildColumn  string
	ParentTable  string
	ParentColumn string
}

// Result raw introspection.
type Result struct {
	Driver   Driver `json:"driver"`
	Schema   string `json:"schema"`
	Database string `json:"database"`
	Tables   []Table
	FKs      []ForeignKey
	Warnings []string `json:"warnings,omitempty"`
}

// Graph is Archly Schema mode React Flow payload.
type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type Node struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Position Position `json:"position"`
	Data     NodeData `json:"data"`
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type NodeData struct {
	TableName string   `json:"tableName"`
	Columns   []Column `json:"columns"`
}

type Edge struct {
	ID     string   `json:"id"`
	Type   string   `json:"type"`
	Source string   `json:"source"`
	Target string   `json:"target"`
	Label  string   `json:"label,omitempty"`
	Data   EdgeData `json:"data"`
}

type EdgeData struct {
	Cardinality string `json:"cardinality"`
	Label       string `json:"label,omitempty"`
	FKColumn    string `json:"fkColumn,omitempty"`
}

// IntrospectResponse is returned by POST /v1/schema/introspect.
type IntrospectResponse struct {
	Driver   string   `json:"driver"`
	Schema   string   `json:"schema"`
	Database string   `json:"database"`
	Tables   int      `json:"tables"`
	Graph    Graph    `json:"graph"`
	Warnings []string `json:"warnings,omitempty"`
}
