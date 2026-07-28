/**
 * Parse Mermaid erDiagram → Schema RF nodes/edges.
 * Supports relationship lines and entity attribute blocks.
 * Tolerant of NVIDIA/SSE quirks: glued ops (`Users||--o{Roles`),
 * split tokens (`timestam` + `ptz`), and quoted labels with newlines.
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

const REL_OPS_LIST = Object.keys(CARD_MAP).sort((a, b) => b.length - a.length);

const REL_OPS = REL_OPS_LIST.map((op) => op.replace(/[|{}.]/g, "\\$&")).join("|");

function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

/** Merge User_OAuth / UserOAuth / user_oauth as one table. */
function canonicalKey(name: string): string {
  return name.toLowerCase().replace(/_/g, "");
}

function tableId(name: string): string {
  return `tbl-${canonicalKey(name)}`;
}

/** Entity token: quoted name, or CamelCase / snake_case, or spaced words (normalized later). */
const ENTITY_NAME =
  `(?:"([^"]+)"|'([^']+)'|([A-Za-z_][\\w]*(?:\\s+[A-Za-z_][\\w]*)*))`;

function entityFromMatch(a?: string, b?: string, c?: string): string {
  return normalizeName(a || b || c || "");
}

const KNOWN_TYPES = new Set([
  "uuid",
  "text",
  "int",
  "integer",
  "bigint",
  "boolean",
  "bool",
  "timestamptz",
  "timestamp",
  "date",
  "numeric",
  "decimal",
  "float",
  "double",
  "jsonb",
  "json",
  "bytea",
  "point",
  "geometry",
  "interval",
]);

/** Collapse spaces inside cardinality operators (SSE / tokenizer artifacts). */
function normalizeErText(raw: string): string {
  let text = raw.trim();
  // If someone pastes raw SSE, strip data: prefixes
  text = text.replace(/^data:\s*/gm, "");
  text = text.replace(/^```(?:mermaid)?\s*/i, "").replace(/```$/i, "").trim();

  // er + Diagram split across tokens with a newline still counts
  text = text.replace(/er\s*\n\s*Diagram/gi, "erDiagram");

  // Tokenizer splits inside types / keywords
  text = text
    .replace(/\btimestam\s*ptz\b/gi, "timestamptz")
    .replace(/\btime\s*stamptz\b/gi, "timestamptz")
    .replace(/\bjson\s*b\b/gi, "jsonb");

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

  // NVIDIA often glues entities to ops: Users||--o{UserRoles → Users ||--o{ UserRoles
  for (const op of REL_OPS_LIST) {
    const esc = op.replace(/[|{}.]/g, "\\$&");
    text = text.replace(new RegExp(`(\\w)${esc}(\\w)`, "g"), `$1 ${op} $2`);
  }

  // Quoted labels may contain newlines from SSE chunking
  text = text.replace(/:\s*"([^"]*)"/g, (_m, inner: string) => {
    const cleaned = String(inner).replace(/\s+/g, " ").trim();
    return cleaned ? `: "${cleaned}"` : "";
  });

  // Join CamelCase identifiers split across newlines (User\nOAuth → UserOAuth).
  // Only Capital-started fragments so "PK\ntext" attribute lines stay intact.
  for (let i = 0; i < 5; i++) {
    const next = text.replace(
      /([A-Z][A-Za-z0-9]*)[ \t]*\n[ \t]*([A-Z][A-Za-z0-9]*)/g,
      "$1$2"
    );
    if (next === text) break;
    text = next;
  }

  return text;
}

function parseColumnLine(line: string): SchemaColumn | null {
  let cleaned = line.trim().replace(/,$/, "");
  if (!cleaned || cleaned.startsWith("%%")) return null;

  // Repair common tokenizer splits: "json b" → jsonb, "time stamptz" leftovers
  cleaned = cleaned
    .replace(/\bjson\s+b\b/gi, "jsonb")
    .replace(/\btimestam\s*ptz\b/gi, "timestamptz")
    .replace(/\btime\s*stamptz\b/gi, "timestamptz");

  let parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;

  // NVIDIA sometimes emits "interval text" (name type) — swap if needed
  if (
    !KNOWN_TYPES.has(parts[0].toLowerCase()) &&
    KNOWN_TYPES.has(parts[1].toLowerCase())
  ) {
    parts = [parts[1], parts[0], ...parts.slice(2)];
  }

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

/** Keep first occurrence of each column name (case-insensitive). */
function dedupeColumns(cols: SchemaColumn[]): SchemaColumn[] {
  const seen = new Set<string>();
  const out: SchemaColumn[] = [];
  for (const c of cols) {
    const k = c.name.toLowerCase();
    if (seen.has(k)) {
      // Merge flags onto the first column
      const prev = out.find((x) => x.name.toLowerCase() === k)!;
      prev.pk = prev.pk || c.pk;
      prev.unique = prev.unique || c.unique;
      if (!prev.fk && c.fk) prev.fk = c.fk;
      continue;
    }
    seen.add(k);
    out.push({ ...c });
  }
  return out;
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

  const tables = new Map<string, SchemaColumn[]>(); // key = canonicalKey
  const displayNames = new Map<string, string>(); // canonical → preferred display
  const relations: {
    from: string;
    to: string;
    card: SchemaCardinality;
    label: string;
  }[] = [];

  const rememberTable = (name: string, cols?: SchemaColumn[]) => {
    const key = canonicalKey(name);
    if (!key) return key;
    const prev = displayNames.get(key);
    // Prefer CamelCase without underscores (UserOAuth over User_OAuth)
    if (!prev || (prev.includes("_") && !name.includes("_"))) {
      displayNames.set(key, name);
    }
    if (cols) {
      const existing = tables.get(key) ?? [];
      tables.set(key, cols.length ? cols : existing);
    } else if (!tables.has(key)) {
      tables.set(key, []);
    }
    return key;
  };

  // 1) Parse + strip relationships FIRST (ops contain `{` / `}`).
  // Optional whitespace — NVIDIA often emits Users||--o{Roles with no spaces.
  const relRe = new RegExp(
    `${ENTITY_NAME}\\s*(${REL_OPS})\\s*${ENTITY_NAME}\\s*(?::\\s*(?:"([^"]*)"|'([^']*)'|([^\\n]+)))?`,
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
      labelDq,
      labelSq,
      labelBare
    ) => {
      const fromName = entityFromMatch(fromQ, fromSq, fromBare);
      const toName = entityFromMatch(toQ, toSq, toBare);
      if (!fromName || !toName) return _full;
      const from = rememberTable(fromName);
      const to = rememberTable(toName);
      const label = String(labelDq || labelSq || labelBare || "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^["']|["']$/g, "");
      const card = CARD_MAP[op] ?? "1:N";
      relations.push({ from, to, card, label: label || "relates" });
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
    rememberTable(name, cols);
  }

  if (tables.size === 0) {
    return { error: "No tables found in erDiagram" };
  }

  // Infer FK markers from 1:N / N:1 relations (child = many side)
  for (const rel of relations) {
    if (rel.card !== "1:N" && rel.card !== "N:1") continue;

    const parentKey = rel.card === "N:1" ? rel.to : rel.from;
    const childKey = rel.card === "N:1" ? rel.from : rel.to;
    const parentName = displayNames.get(parentKey) ?? parentKey;

    const cols = tables.get(childKey) ?? [];
    const fkName = `${parentName.toLowerCase().replace(/s$/, "")}_id`;
    const existing = cols.find(
      (c) =>
        c.name.toLowerCase() === fkName ||
        c.name.toLowerCase() === `${parentName.toLowerCase()}_id` ||
        (c.fk && c.fk.table === "?")
    );
    if (existing) {
      existing.fk = { table: parentName, column: "id" };
    } else if (!cols.some((c) => c.fk)) {
      cols.push({
        name: `${parentName.toLowerCase()}_id`,
        type: "uuid",
        fk: { table: parentName, column: "id" },
        nullable: false,
      });
      tables.set(childKey, cols);
    }
  }

  for (const [key, cols] of tables) {
    const deduped = dedupeColumns(cols);
    if (!deduped.some((c) => c.pk)) {
      const idCol = deduped.find((c) => c.name.toLowerCase() === "id");
      if (idCol) {
        idCol.pk = true;
        idCol.nullable = false;
      } else {
        deduped.unshift({
          name: "id",
          type: "uuid",
          pk: true,
          nullable: false,
        });
      }
    }
    tables.set(key, deduped);
  }

  const keys = [...tables.keys()];
  const colsPerRow = Math.ceil(Math.sqrt(keys.length));
  const nodes: SchemaNode[] = keys.map((key, i) => {
    const col = i % colsPerRow;
    const row = Math.floor(i / colsPerRow);
    const name = displayNames.get(key) ?? key;
    const data: SchemaTableData = {
      tableName: name,
      columns: tables.get(key) ?? [],
    };
    return {
      id: tableId(name),
      type: "schemaTable",
      position: { x: col * 280, y: row * 320 },
      data,
    };
  });

  const edges: SchemaEdge[] = relations.map((rel, i) => {
    const fromName = displayNames.get(rel.from) ?? rel.from;
    const toName = displayNames.get(rel.to) ?? rel.to;
    const data: SchemaRelationData = {
      cardinality: rel.card,
      label: rel.label,
    };
    return {
      id: `rel-${i}-${tableId(fromName)}-${tableId(toName)}`,
      type: "schemaRelation",
      source: tableId(fromName),
      target: tableId(toName),
      label: `${rel.card}${rel.label ? ` · ${rel.label}` : ""}`,
      data,
    };
  });

  return { nodes, edges };
}

/** Pull erDiagram from mixed LLM output. */
export function extractErDiagram(raw: string): string | null {
  let body = raw.replace(/^data:\s*/gm, "").trim();
  const fenced = body.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  body = (fenced?.[1] ?? body).trim();
  body = body.replace(/er\s*\n\s*Diagram/gi, "erDiagram");
  const idx = body.search(/erDiagram/i);
  if (idx < 0) return null;
  return body.slice(idx).trim();
}
