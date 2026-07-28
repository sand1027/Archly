/**
 * Compare two schema graphs (baseline vs live re-import).
 */

import type { SchemaColumn } from "@/types/schema";
import type { SchemaEdge, SchemaNode } from "@/store/schema.store";

export type SchemaDiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface TableDiff {
  name: string;
  status: SchemaDiffStatus;
  addedColumns: string[];
  removedColumns: string[];
  changedColumns: string[];
}

export interface SchemaDiffResult {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  tables: TableDiff[];
}

function tableMap(nodes: SchemaNode[]): Map<string, SchemaColumn[]> {
  const m = new Map<string, SchemaColumn[]>();
  for (const n of nodes) {
    const name = String(n.data?.tableName ?? "").trim();
    if (!name) continue;
    m.set(name.toLowerCase(), (n.data?.columns ?? []) as SchemaColumn[]);
  }
  return m;
}

function colKey(c: SchemaColumn): string {
  return `${c.name}|${c.type}|${c.pk ? "pk" : ""}|${c.fk?.table ?? ""}|${c.nullable ? "n" : "nn"}`;
}

function diffColumns(before: SchemaColumn[], after: SchemaColumn[]) {
  const beforeNames = new Map(before.map((c) => [c.name.toLowerCase(), c]));
  const afterNames = new Map(after.map((c) => [c.name.toLowerCase(), c]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [lower, col] of afterNames) {
    if (!beforeNames.has(lower)) added.push(col.name);
    else if (colKey(beforeNames.get(lower)!) !== colKey(col)) changed.push(col.name);
  }
  for (const [lower, col] of beforeNames) {
    if (!afterNames.has(lower)) removed.push(col.name);
  }

  return { added, removed, changed };
}

export function diffSchemaGraphs(
  baseline: SchemaNode[],
  incoming: SchemaNode[]
): SchemaDiffResult {
  const base = tableMap(baseline);
  const next = tableMap(incoming);
  const allNames = new Set([...base.keys(), ...next.keys()]);

  const tables: TableDiff[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const key of [...allNames].sort()) {
    const b = base.get(key);
    const n = next.get(key);
    const displayName = n?.length ? incoming.find((x) => x.data?.tableName?.toLowerCase() === key)?.data?.tableName : baseline.find((x) => x.data?.tableName?.toLowerCase() === key)?.data?.tableName;
    const name = String(displayName ?? key);

    if (b && !n) {
      tables.push({ name, status: "removed", addedColumns: [], removedColumns: b.map((c) => c.name), changedColumns: [] });
      removed++;
      continue;
    }
    if (!b && n) {
      tables.push({ name, status: "added", addedColumns: n.map((c) => c.name), removedColumns: [], changedColumns: [] });
      added++;
      continue;
    }
    if (!b || !n) continue;

    const cols = diffColumns(b, n);
    if (cols.added.length || cols.removed.length || cols.changed.length) {
      tables.push({
        name,
        status: "changed",
        addedColumns: cols.added,
        removedColumns: cols.removed,
        changedColumns: cols.changed,
      });
      changed++;
    } else {
      tables.push({ name, status: "unchanged", addedColumns: [], removedColumns: [], changedColumns: [] });
      unchanged++;
    }
  }

  return { added, removed, changed, unchanged, tables };
}

export function diffStatusColor(status: SchemaDiffStatus): string {
  switch (status) {
    case "added":
      return "#16a34a";
    case "removed":
      return "#dc2626";
    case "changed":
      return "#d97706";
    default:
      return "transparent";
  }
}

export function annotateNodesWithDiff(
  nodes: SchemaNode[],
  diff: SchemaDiffResult
): SchemaNode[] {
  const byName = new Map(diff.tables.map((t) => [t.name.toLowerCase(), t.status]));
  return nodes.map((n) => {
    const name = String(n.data?.tableName ?? "").toLowerCase();
    const status = byName.get(name);
    if (!status || status === "unchanged") {
      const { diffStatus: _d, ...rest } = n.data ?? {};
      return { ...n, data: rest };
    }
    return { ...n, data: { ...n.data, diffStatus: status } };
  });
}

/** Summarize FK edges for a table. */
export function tableConnections(
  tableName: string,
  nodes: SchemaNode[],
  edges: SchemaEdge[]
): { inbound: string[]; outbound: string[] } {
  const id = nodes.find((n) => n.data?.tableName === tableName)?.id;
  if (!id) return { inbound: [], outbound: [] };

  const nameById = new Map(nodes.map((n) => [n.id, String(n.data?.tableName ?? n.id)]));

  const inbound: string[] = [];
  const outbound: string[] = [];
  for (const e of edges) {
    if (e.target === id) inbound.push(nameById.get(e.source) ?? e.source);
    if (e.source === id) outbound.push(nameById.get(e.target) ?? e.target);
  }
  return { inbound, outbound };
}
