/**
 * AI prompts + diagram snapshot for schema explain (canvas-chat).
 */

import type { SchemaEdge, SchemaNode } from "@/store/schema.store";
import type { SchemaColumn } from "@/types/schema";
import { tableConnections } from "./schema-diff";

export function buildSchemaDiagramSnapshot(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  selectedTableId: string | null
) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: String(n.data?.tableName ?? n.id),
      componentId: "database-table",
      description: columnSummary((n.data?.columns ?? []) as SchemaColumn[]),
    })),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
    })),
    selection: selectedTableId ? [selectedTableId] : [],
    chaos: [],
    metrics: [],
  };
}

function columnSummary(cols: SchemaColumn[]): string {
  return cols
    .slice(0, 16)
    .map((c) => {
      const flags = [c.pk && "PK", c.fk && `FK→${c.fk.table}`, c.unique && "UK"].filter(Boolean).join(",");
      return flags ? `${c.name}:${c.type}(${flags})` : `${c.name}:${c.type}`;
    })
    .join(", ");
}

export function explainTablePrompt(
  tableName: string,
  nodes: SchemaNode[],
  edges: SchemaEdge[]
): string {
  const node = nodes.find((n) => n.data?.tableName === tableName);
  const cols = ((node?.data?.columns ?? []) as SchemaColumn[])
    .map((c) => {
      const meta = [
        c.pk ? "primary key" : "",
        c.fk ? `references ${c.fk.table}.${c.fk.column}` : "",
        c.unique ? "unique" : "",
      ]
        .filter(Boolean)
        .join(", ");
      return `- ${c.name} (${c.type})${meta ? `: ${meta}` : ""}`;
    })
    .join("\n");

  const { inbound, outbound } = tableConnections(tableName, nodes, edges);

  return `You are Archly's database schema assistant. Explain this table in plain English for a developer.

Table: ${tableName}

Columns:
${cols || "(none)"}

Connected FROM (references this table): ${inbound.length ? inbound.join(", ") : "none detected"}
Connected TO (this table references): ${outbound.length ? outbound.join(", ") : "none detected"}

Answer in 4–6 sentences covering:
1. What business entity or concept this table/collection represents
2. Why each important column exists
3. How it connects to other tables and what those relationships mean in the app
4. Typical read/write patterns (who creates rows, who reads them)

Do not output JSON or code fences. Be specific to the names above.`;
}

export function explainSchemaPrompt(nodes: SchemaNode[], edges: SchemaEdge[]): string {
  const summary = summarizeSchemaConnections(nodes, edges);
  return `You are Archly's database schema assistant. The user imported this database schema:

${summary}

Give a concise architecture overview (8–12 sentences):
- What domain/system this schema represents
- Core entities and how they relate
- Auth/user patterns if present
- Notable design choices (shared IDs, denormalization, audit tables)
- Which services/APIs would likely own which tables

Do not output JSON or Mermaid. Write for a new engineer onboarding to the codebase.`;
}

function summarizeSchemaConnections(nodes: SchemaNode[], edges: SchemaEdge[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    const name = String(n.data?.tableName ?? "");
    const cols = ((n.data?.columns ?? []) as SchemaColumn[]).length;
    lines.push(`• ${name} (${cols} columns)`);
  }
  lines.push("");
  lines.push("Relationships:");
  for (const e of edges.slice(0, 60)) {
    const src = nodes.find((n) => n.id === e.source)?.data?.tableName;
    const tgt = nodes.find((n) => n.id === e.target)?.data?.tableName;
    if (!src || !tgt) continue;
    const label = e.data?.label ?? e.data?.fkColumn ?? "relates";
    lines.push(`• ${src} → ${tgt} (${e.data?.cardinality ?? "1:N"}, ${label})`);
  }
  return lines.join("\n");
}

export { tableConnections };
