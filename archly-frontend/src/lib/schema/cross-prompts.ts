/**
 * Cross-mode prompts: Schema ↔ Architecture.
 * Phrasing matches Modelfile / ai.service user prompts:
 *   "Design the production system architecture for: …"
 *   "Design the production database schema for: …"
 */

import type { SchemaColumn } from "@/types/schema";
import type { SchemaEdge, SchemaNode } from "@/store/schema.store";

function tableName(n: SchemaNode): string {
  return String(n?.data?.tableName ?? "table").trim() || "table";
}

function summarizeSchema(nodes: SchemaNode[], edges: SchemaEdge[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    const name = tableName(n);
    const cols = ((n.data?.columns ?? []) as SchemaColumn[])
      .slice(0, 12)
      .map((c) => {
        const flags = [
          c.pk ? "PK" : "",
          c.fk ? `FK→${c.fk.table}` : "",
          c.unique ? "UK" : "",
        ]
          .filter(Boolean)
          .join(",");
        return flags ? `${c.name}:${c.type}(${flags})` : `${c.name}:${c.type}`;
      })
      .join(", ");
    lines.push(`- ${name} { ${cols || "id"} }`);
  }

  if (edges.length) {
    lines.push("Relationships:");
    for (const e of edges.slice(0, 40)) {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      if (!src || !tgt) continue;
      const card = e.data?.cardinality ?? "1:N";
      const label = e.data?.label ? ` (${e.data.label})` : "";
      lines.push(`- ${tableName(src)} ${card} ${tableName(tgt)}${label}`);
    }
  }

  return lines.join("\n");
}

/** Prompt to generate system architecture from the current ERD (Modelfile-style). */
export function architectureForThisSchemaPrompt(
  nodes: SchemaNode[],
  edges: SchemaEdge[]
): string | null {
  if (!nodes.length) return null;
  const body = summarizeSchema(nodes, edges);
  return `Design the production system architecture for: a platform whose database schema is:

${body}

Map tables to services, APIs, caches, queues, and datastores. Include CDN/LB, auth, write path, read path, workers, and observability. Keep the architecture coherent with the entities and FKs above. Output ONLY Mermaid flowchart TD — not an ERD.`;
}

/** Prompt to generate ERD from the current Flow architecture (Modelfile-style). */
export function schemaForThisArchitecturePrompt(
  nodes: { id: string; data?: { label?: string; componentId?: string } }[],
  edges: { source: string; target: string }[]
): string | null {
  if (!nodes.length) return null;

  const serviceLines = nodes.slice(0, 60).map((n) => {
    const label = String(n.data?.label ?? n.id).trim();
    const kind = n.data?.componentId ? ` [${n.data.componentId}]` : "";
    return `- ${label}${kind}`;
  });

  const edgeLines = edges.slice(0, 80).map((e) => {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
    const sl = String(s?.data?.label ?? e.source);
    const tl = String(t?.data?.label ?? e.target);
    return `- ${sl} → ${tl}`;
  });

  return `Design the production database schema for: a system with this architecture:

Components:
${serviceLines.join("\n")}

Connections:
${edgeLines.length ? edgeLines.join("\n") : "(none)"}

Interpret this as a real platform data model — invent detailed tables (5–12 columns each), relationships, and FKs. Aim for 30–40 tables and 35–55 relationships covering auth, core domain, join tables, and audit. Output ONLY Mermaid starting with "erDiagram". No flowchart. No other text.`;
}
