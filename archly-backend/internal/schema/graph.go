package schema

import (
	"fmt"
	"strings"
)

func canonicalKey(name string) string {
	return strings.ToLower(strings.ReplaceAll(name, "_", ""))
}

func tableNodeID(name string) string {
	return "tbl-" + canonicalKey(name)
}

// ToGraph converts introspection result → React Flow nodes/edges for Schema mode.
func ToGraph(res *Result) Graph {
	const colW = 280.0
	const rowH = 320.0
	colsPerRow := 4
	if len(res.Tables) > 12 {
		colsPerRow = 6
	}

	nodes := make([]Node, 0, len(res.Tables))
	idByTable := map[string]string{}

	for i, t := range res.Tables {
		id := tableNodeID(t.Name)
		idByTable[t.Name] = id
		col := i % colsPerRow
		row := i / colsPerRow
		nodes = append(nodes, Node{
			ID:   id,
			Type: "schemaTable",
			Position: Position{
				X: float64(col) * colW,
				Y: float64(row) * rowH,
			},
			Data: NodeData{
				TableName: t.Name,
				Columns:   t.Columns,
			},
		})
	}

	edgeHave := map[string]bool{}
	var edges []Edge

	for _, fk := range res.FKs {
		parentID, okP := idByTable[fk.ParentTable]
		childID, okC := idByTable[fk.ChildTable]
		if !okP || !okC || parentID == childID {
			continue
		}
		key := parentID + "->" + childID + ":" + fk.ChildColumn
		if edgeHave[key] {
			continue
		}
		edgeHave[key] = true
		label := labelFromFKColumn(fk.ChildColumn)
		cardinality := "1:N"
		if fk.ChildColumn == "_id" && fk.ParentColumn == "_id" {
			cardinality = "1:1"
			label = "same id"
		}
		edges = append(edges, Edge{
			ID:     fmt.Sprintf("rel-fk-%s-%s-%s", parentID, childID, fk.ChildColumn),
			Type:   "schemaRelation",
			Source: parentID,
			Target: childID,
			Label:  label,
			Data: EdgeData{
				Cardinality: cardinality,
				Label:       label,
				FKColumn:    fk.ChildColumn,
			},
		})
	}

	return Graph{Nodes: nodes, Edges: edges}
}

// ToResponse builds the API payload.
func ToResponse(res *Result) IntrospectResponse {
	return IntrospectResponse{
		Driver:   string(res.Driver),
		Schema:   res.Schema,
		Database: res.Database,
		Tables:   len(res.Tables),
		Graph:    ToGraph(res),
		Warnings: res.Warnings,
	}
}
