/**
 * Parse Mermaid erDiagram → Schema RF nodes/edges.
 * Supports relationship lines and entity attribute blocks.
 */

import type {
  SchemaCardinality,
  SchemaColumn,
  SchemaRelationData,
  SchemaTableData,
} from "@/types/schema";
import type { SchemaEdge, SchemaNode } from "@/store/schema.store";

export interface ErConvertResult {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
}

export interface ErConvertError {
  error: string;
}

const CARD_MAP: Record<string, SchemaCardinality> = {
  "||--||": "1:1",
  "||--o|": "1:1",
  "|o--||": "1:1",
  "||--|{": "1:N",
  "||--o{": "1:N",
  "}|--||": "N:1",
  "}o--||": "N:1",
  "}|--|{": "N:M",
  "}o--o{": "N:M",
  "}|--o{": "N:M",
  "}o--|{": "N:M",
};

function normalizeName(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

function tableId(name: string): string {
  return `tbl-${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
}

function parseColumnLine(line: string): SchemaColumn | null {
  // Examples:
  //   uuid id PK
  //   string email UK
  //   int user_id FK
  //   timestamptz created_at
  const cleaned = line.trim().replace(/,$/, "");
  if (!cleaned || cleaned.startsWith("%%")) return null;

  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;

  const type = parts[0];
  const name = parts[1];
  const flags = parts.slice(2).map((p) => p.toUpperCase());

  const col: SchemaColumn = {
    name,
    type,
    pk: flags.includes("PK"),
    unique: flags.includes("UK") || flags.includes("UNIQUE"),
    nullable: !flags.includes("PK") && !flags.includes("NOT_NULL"),
  };

  if (flags.includes("FK")) {
    col.fk = { table: "?", column: "id" };
  }

  return col;
}

/**
 * Convert erDiagram Mermaid into schema graph.
 */
export function convertErDiagramToSchema(
  mermaid: string
): ErConvertResult | ErConvertError {
  let text = mermaid.trim();
  text = text.replace(/^```(?:mermaid)?\s*/i, "").replace(/```$/i, "").trim();

  if (!/erDiagram/i.test(text)) {
    return { error: "Not an erDiagram — expected Mermaid starting with erDiagram" };
  }

  // Drop header
  text = text.replace(/^\s*erDiagram\s*/i, "");

  const tables = new Map<string, SchemaColumn[]>();
  const relations: {
    from: string;
    to: string;
    card: SchemaCardinality;
    label: string;
  }[] = [];

  // Entity blocks: USERS { ... }
  const blockRe = /([A-Za-z_][\w]*)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(text)) !== null) {
    const name = normalizeName(m[1]);
    const body = m[2];
    const cols: SchemaColumn[] = [];
    for (const line of body.split("\n")) {
      const col = parseColumnLine(line);
      if (col) cols.push(col);
    }
    tables.set(name, cols.length ? cols : tables.get(name) ?? []);
  }

  // Strip blocks so relation lines are easier to parse
  const withoutBlocks = text.replace(blockRe, "\n");

  // Relations: A ||--o{ B : "label"
  const relRe =
    /([A-Za-z_][\w]*)\s+(\|\|--\|\||\|\|--o\||\|o--\|\||\|\|--\|\{|\|\|--o\{|\}\|--\|\||\}o--\|\||\}\|--\|\{|\}o--o\{|\}\|--o\{|\}o--\|\{)\s+([A-Za-z_][\w]*)\s*(?::\s*["']?([^"'\n]*)["']?)?/g;

  while ((m = relRe.exec(withoutBlocks)) !== null) {
    const from = normalizeName(m[1]);
    const op = m[2];
    const to = normalizeName(m[3]);
    const label = (m[4] ?? "").trim() || "relates";
    const card = CARD_MAP[op] ?? "1:N";

    if (!tables.has(from)) tables.set(from, []);
    if (!tables.has(to)) tables.set(to, []);

    relations.push({ from, to, card, label });
  }

  if (tables.size === 0) {
    return { error: "No tables found in erDiagram" };
  }

  // Infer FK markers from 1:N / N:1 relations (child = many side)
  for (const rel of relations) {
    if (rel.card !== "1:N" && rel.card !== "N:1") continue;

    const parent = rel.card === "N:1" ? rel.to : rel.from;
    const child = rel.card === "N:1" ? rel.from : rel.to;

    const cols = tables.get(child) ?? [];
    const fkName = `${parent.toLowerCase().replace(/s$/, "")}_id`;
    const existing = cols.find(
      (c) =>
        c.name.toLowerCase() === fkName ||
        c.name.toLowerCase() === `${parent.toLowerCase()}_id` ||
        (c.fk && c.fk.table === "?")
    );
    if (existing) {
      existing.fk = { table: parent, column: "id" };
    } else {
      const hasFk = cols.some((c) => c.fk);
      if (!hasFk) {
        cols.push({
          name: `${parent.toLowerCase()}_id`,
          type: "uuid",
          fk: { table: parent, column: "id" },
          nullable: false,
        });
        tables.set(child, cols);
      }
    }
  }

  // Ensure every table has at least an id PK
  for (const [name, cols] of tables) {
    if (!cols.some((c) => c.pk)) {
      tables.set(name, [
        { name: "id", type: "uuid", pk: true, nullable: false },
        ...cols,
      ]);
    }
  }

  // Layout in a grid
  const names = [...tables.keys()];
  const colsPerRow = Math.ceil(Math.sqrt(names.length));
  const nodes: SchemaNode[] = names.map((name, i) => {
    const col = i % colsPerRow;
    const row = Math.floor(i / colsPerRow);
    const data: SchemaTableData = {
      tableName: name,
      columns: tables.get(name) ?? [],
    };
    return {
      id: tableId(name),
      type: "schemaTable",
      position: { x: col * 280, y: row * 320 },
      data,
    };
  });

  const edges: SchemaEdge[] = relations.map((rel, i) => {
    const data: SchemaRelationData = {
      cardinality: rel.card,
      label: rel.label,
    };
    return {
      id: `rel-${i}-${tableId(rel.from)}-${tableId(rel.to)}`,
      type: "schemaRelation",
      source: tableId(rel.from),
      target: tableId(rel.to),
      label: `${rel.card}${rel.label ? ` · ${rel.label}` : ""}`,
      data,
    };
  });

  return { nodes, edges };
}

/** Pull erDiagram from mixed LLM output. */
export function extractErDiagram(raw: string): string | null {
  const fenced = raw.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  const idx = body.search(/erDiagram/i);
  if (idx < 0) return null;
  return body.slice(idx).trim();
}
