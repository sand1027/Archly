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

const REL_OPS = Object.keys(CARD_MAP)
  .sort((a, b) => b.length - a.length)
  .map((op) => op.replace(/[|{}.]/g, "\\$&"))
  .join("|");

function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

/** Entity token: quoted name, or CamelCase / snake_case, or spaced words (normalized later). */
const ENTITY_NAME =
  `(?:"([^"]+)"|'([^']+)'|([A-Za-z_][\\w]*(?:\\s+[A-Za-z_][\\w]*)*))`;

function entityFromMatch(a?: string, b?: string, c?: string): string {
  return normalizeName(a || b || c || "");
}

function tableId(name: string): string {
  return `tbl-${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
}

/** Collapse spaces inside cardinality operators (SSE / tokenizer artifacts). */
function normalizeErText(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:mermaid)?\s*/i, "").replace(/```$/i, "").trim();

  // er + Diagram split across tokens with a newline still counts
  text = text.replace(/er\s*\n\s*Diagram/gi, "erDiagram");

  // Only safe, explicit spaced-operator fixes (never char-by-char — `|` breaks RegExp).
  const spacedOps: [RegExp, string][] = [
    [/\|\|\s*--\s*\|\|/g, "||--||"],
    [/\|\|\s*--\s*o\s*\|/g, "||--o|"],
    [/\|o\s*--\s*\|\|/g, "|o--||"],
    [/\|\|\s*--\s*\|\s*\{/g, "||--|{"],
    [/\|\|\s*--\s*o\s*\{/g, "||--o{"],
    [/\}\|\s*--\s*\|\|/g, "}|--||"],
    [/\}o\s*--\s*\|\|/g, "}o--||"],
    [/\}\|\s*--\s*\|\s*\{/g, "}|--|{"],
    [/\}o\s*--\s*o\s*\{/g, "}o--o{"],
    [/\}\|\s*--\s*o\s*\{/g, "}|--o{"],
    [/\}o\s*--\s*\|\s*\{/g, "}o--|{"],
  ];
  for (const [re, op] of spacedOps) {
    text = text.replace(re, op);
  }

  return text;
}

function parseColumnLine(line: string): SchemaColumn | null {
  let cleaned = line.trim().replace(/,$/, "");
  if (!cleaned || cleaned.startsWith("%%")) return null;

  // Repair common tokenizer splits: "json b" → jsonb, "time stamptz" leftovers
  cleaned = cleaned
    .replace(/\bjson\s+b\b/gi, "jsonb")
    .replace(/\btime\s*stamptz\b/gi, "timestamptz");

  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;

  const type = parts[0];
  const name = parts[1];
  if (!name || /^(PK|FK|UK)$/i.test(name)) return null;

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
 *
 * IMPORTANT: relationship operators like `||--o{` contain `{` and must be
 * stripped BEFORE entity-block parsing, otherwise `o{ ... }` eats real tables.
 */
export function convertErDiagramToSchema(
  mermaid: string
): ErConvertResult | ErConvertError {
  let text = normalizeErText(mermaid);

  if (!/erDiagram/i.test(text)) {
    return { error: "Not an erDiagram — expected Mermaid starting with erDiagram" };
  }

  text = text.replace(/^\s*erDiagram\s*/i, "");

  const tables = new Map<string, SchemaColumn[]>();
  const relations: {
    from: string;
    to: string;
    card: SchemaCardinality;
    label: string;
  }[] = [];

  // 1) Parse + strip relationships FIRST (ops contain `{` / `}`).
  const relRe = new RegExp(
    `${ENTITY_NAME}\\s+(${REL_OPS})\\s+${ENTITY_NAME}\\s*(?::\\s*["']?([^"'\\n]*)["']?)?`,
    "g"
  );

  text = text.replace(
    relRe,
    (
      _full,
      fromQ,
      fromSq,
      fromBare,
      op,
      toQ,
      toSq,
      toBare,
      labelRaw
    ) => {
      const from = entityFromMatch(fromQ, fromSq, fromBare);
      const to = entityFromMatch(toQ, toSq, toBare);
      if (!from || !to) return _full;
      const label = String(labelRaw ?? "").trim() || "relates";
      const card = CARD_MAP[op] ?? "1:N";
      relations.push({ from, to, card, label });
      if (!tables.has(from)) tables.set(from, []);
      if (!tables.has(to)) tables.set(to, []);
      return "\n";
    }
  );

  // 2) Entity attribute blocks — safe now that `||--o{` is gone.
  const blockRe = new RegExp(`${ENTITY_NAME}\\s*\\{([^}]*)\\}`, "g");
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(text)) !== null) {
    const name = entityFromMatch(m[1], m[2], m[3]);
    // Skip operator debris
    if (name.length < 2 || name === "o") continue;

    const cols: SchemaColumn[] = [];
    for (const line of m[4].split("\n")) {
      const col = parseColumnLine(line);
      if (col) cols.push(col);
    }
    const prev = tables.get(name) ?? [];
    tables.set(name, cols.length ? cols : prev);
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
    } else if (!cols.some((c) => c.fk)) {
      cols.push({
        name: `${parent.toLowerCase()}_id`,
        type: "uuid",
        fk: { table: parent, column: "id" },
        nullable: false,
      });
      tables.set(child, cols);
    }
  }

  for (const [name, cols] of tables) {
    if (!cols.some((c) => c.pk)) {
      tables.set(name, [
        { name: "id", type: "uuid", pk: true, nullable: false },
        ...cols,
      ]);
    }
  }

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
  let body = (fenced?.[1] ?? raw).trim();
  body = body.replace(/er\s*\n\s*Diagram/gi, "erDiagram");
  const idx = body.search(/erDiagram/i);
  if (idx < 0) return null;
  return body.slice(idx).trim();
}
