/**
 * Build relationship edges from FK column refs + optional explicit relations.
 */

import type { SchemaCardinality, SchemaColumn, SchemaRelationData } from "@/types/schema";
import type { SchemaEdge, SchemaNode } from "@/store/schema.store";

function tableNameOf(n: SchemaNode): string {
  return String(n?.data?.tableName ?? "").trim();
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/** Match FK table name to a node id (handles users / user / Users). */
export function findTableNodeId(
  nodes: SchemaNode[],
  refName: string
): string | null {
  const want = normalize(refName);
  if (!want || want === "?") return null;

  for (const n of nodes) {
    const tn = normalize(tableNameOf(n));
    if (tn === want) return n.id;
  }
  // soft: users ↔ user
  const singular = want.endsWith("s") ? want.slice(0, -1) : `${want}s`;
  for (const n of nodes) {
    const tn = normalize(tableNameOf(n));
    if (tn === singular) return n.id;
  }
  return null;
}

function edgeKey(source: string, target: string): string {
  return `${source}->${target}`;
}

/**
 * Create missing schemaRelation edges for every FK column that points at
 * another table currently on the canvas.
 */
export function edgesFromForeignKeys(
  nodes: SchemaNode[],
  existing: SchemaEdge[] = []
): SchemaEdge[] {
  const have = new Set(
    existing.map((e) => edgeKey(String(e.source), String(e.target)))
  );
  const out: SchemaEdge[] = [];

  for (const child of nodes) {
    const cols = (child.data?.columns ?? []) as SchemaColumn[];
    for (const col of cols) {
      if (!col.fk?.table) continue;
      const parentId = findTableNodeId(nodes, col.fk.table);
      if (!parentId || parentId === child.id) continue;
      const key = edgeKey(parentId, child.id);
      if (have.has(key)) continue;
      have.add(key);

      const data: SchemaRelationData = {
        cardinality: "1:N",
        label: col.name.replace(/_id$/, "") || "has",
        fkColumn: col.name,
      };
      out.push({
        id: `rel-fk-${parentId}-${child.id}-${col.name}`,
        type: "schemaRelation",
        source: parentId,
        target: child.id,
        data,
      });
    }
  }

  return out;
}

/** Ensure FK-derived edges are present alongside any explicit edges. */
export function withFkEdges(
  nodes: SchemaNode[],
  edges: SchemaEdge[]
): SchemaEdge[] {
  const extras = edgesFromForeignKeys(nodes, edges);
  return extras.length ? [...edges, ...extras] : edges;
}

export function mergeSchemaGraphs(
  existingNodes: SchemaNode[],
  existingEdges: SchemaEdge[],
  incomingNodes: SchemaNode[],
  incomingEdges: SchemaEdge[]
): { nodes: SchemaNode[]; edges: SchemaEdge[] } {
  const byName = new Map<string, SchemaNode>();
  for (const n of existingNodes) {
    byName.set(normalize(tableNameOf(n)), n);
  }

  const offsetX =
    existingNodes.length > 0
      ? Math.max(...existingNodes.map((n) => n.position?.x ?? 0)) + 300
      : 0;

  const idRemap = new Map<string, string>();
  const added: SchemaNode[] = [];

  for (const n of incomingNodes) {
    const key = normalize(tableNameOf(n));
    const prev = byName.get(key);
    if (prev) {
      idRemap.set(n.id, prev.id);
      // Merge columns (incoming wins on same name)
      const prevCols = (prev.data?.columns ?? []) as SchemaColumn[];
      const nextCols = (n.data?.columns ?? []) as SchemaColumn[];
      const colMap = new Map(prevCols.map((c) => [c.name.toLowerCase(), c]));
      for (const c of nextCols) colMap.set(c.name.toLowerCase(), c);
      prev.data = {
        ...prev.data,
        columns: [...colMap.values()],
      };
    } else {
      const copy = {
        ...n,
        position: {
          x: (n.position?.x ?? 0) + offsetX,
          y: n.position?.y ?? 0,
        },
      };
      byName.set(key, copy);
      added.push(copy);
      idRemap.set(n.id, copy.id);
    }
  }

  const nodes = [...byName.values()];
  const edgeHave = new Set(
    existingEdges.map((e) => edgeKey(String(e.source), String(e.target)))
  );
  const edges = [...existingEdges];

  for (const e of incomingEdges) {
    const source = idRemap.get(String(e.source)) ?? String(e.source);
    const target = idRemap.get(String(e.target)) ?? String(e.target);
    const key = edgeKey(source, target);
    if (edgeHave.has(key)) continue;
    if (!nodes.some((n) => n.id === source) || !nodes.some((n) => n.id === target)) {
      continue;
    }
    edgeHave.add(key);
    edges.push({ ...e, source, target, id: `rel-m-${source}-${target}` });
  }

  return { nodes, edges: withFkEdges(nodes, edges) };
}

export function looksLikeSchemaIncremental(prompt: string): boolean {
  const p = prompt.trim();
  return (
    /\b(add|create|insert|append|new)\b[\s\S]{0,48}\b(table|column|field|relation|relationship|fk|foreign\s*key)\b/i.test(
      p
    ) || /\b(add|create)\s+(a\s+|an\s+|new\s+)?[a-z_][\w]*\s+table\b/i.test(p)
  );
}

export type { SchemaCardinality };
