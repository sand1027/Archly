/**
 * Schema store — React Flow graph for Database Schema / ERD mode.
 * Isolated from architecture Flow store (no chaos / sim coupling).
 */

import { create } from "zustand";
import type { SchemaCardinality, SchemaColumn, SchemaTableData } from "@/types/schema";
import { edgesFromForeignKeys, withFkEdges } from "@/lib/schema/schema-edges";

export interface XYPosition {
  x: number;
  y: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SchemaNode = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SchemaEdge = any;

interface SchemaSnapshot {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
}

export interface SchemaImportMeta {
  driver: string;
  database: string;
  schema: string;
}

export interface SchemaSessionConnection {
  url: string;
  database?: string;
  schema?: string;
  driver: string;
}

const MAX_HISTORY = 50;

function cloneSnap(nodes: SchemaNode[], edges: SchemaEdge[]): SchemaSnapshot {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

export interface SchemaStore {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  selectedTableId: string | null;
  past: SchemaSnapshot[];
  future: SchemaSnapshot[];
  fitViewNonce: number;
  importMeta: SchemaImportMeta | null;
  sessionConnection: SchemaSessionConnection | null;
  baselineNodes: SchemaNode[];
  baselineEdges: SchemaEdge[];
  setSelectedTableId: (id: string | null) => void;
  onNodesChange: (changes: unknown[]) => void;
  onEdgesChange: (changes: unknown[]) => void;
  onConnect: (connection: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => void;
  addTable: (tableName: string, columns: SchemaColumn[], position: XYPosition) => string;
  /** Drop a multi-table starter pack with relationships laid out on the canvas. */
  applyPack: (
    tables: { tableName: string; columns: SchemaColumn[] }[],
    relations: {
      from: string;
      to: string;
      cardinality: SchemaCardinality;
      label: string;
    }[],
    origin?: XYPosition
  ) => void;
  /** Replace or merge graph; always wires FK-based connections. */
  setGraph: (nodes: SchemaNode[], edges: SchemaEdge[], opts?: { merge?: boolean }) => void;
  /** Save import metadata + baseline for drift diff / re-import. */
  setImportContext: (
    meta: SchemaImportMeta,
    connection: SchemaSessionConnection,
    nodes: SchemaNode[],
    edges: SchemaEdge[]
  ) => void;
  updateTable: (nodeId: string, patch: Partial<SchemaTableData>) => void;
  removeTable: (nodeId: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  requestFitView: () => void;
}

let tableCounter = 0;
const newId = () => `tbl-${++tableCounter}-${Date.now()}`;
const newEdgeId = () => `rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function withHistory(
  set: (fn: (s: SchemaStore) => Partial<SchemaStore>) => void,
  get: () => SchemaStore,
  mutator: (s: SchemaStore) => Partial<SchemaStore>
) {
  const s = get();
  const past = [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY);
  set(() => ({ ...mutator(s), past, future: [] }));
}

export const useSchemaStore = create<SchemaStore>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedTableId: null,
  past: [],
  future: [],
  fitViewNonce: 0,
  importMeta: null,
  sessionConnection: null,
  baselineNodes: [],
  baselineEdges: [],

  setSelectedTableId: (id) => set({ selectedTableId: id }),

  onNodesChange: (changes) => {
    // Lazy apply to avoid importing @xyflow at module top (SSR)
    void import("@xyflow/react").then(({ applyNodeChanges }) => {
      set((s) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: applyNodeChanges(changes as any, s.nodes),
      }));
    });
  },

  onEdgesChange: (changes) => {
    void import("@xyflow/react").then(({ applyEdgeChanges }) => {
      set((s) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edges: applyEdgeChanges(changes as any, s.edges),
      }));
    });
  },

  onConnect: (connection) => {
    void import("@xyflow/react").then(({ addEdge }) => {
      withHistory(set, get, (s) => ({
        edges: addEdge(
          {
            ...connection,
            id: newEdgeId(),
            type: "schemaRelation",
            data: { cardinality: "1:N", label: "has" },
          },
          s.edges
        ),
      }));
    });
  },

  addTable: (tableName, columns, position) => {
    const id = newId();
    withHistory(set, get, (s) => {
      const node = {
        id,
        type: "schemaTable",
        position,
        data: { tableName, columns } satisfies SchemaTableData,
      };
      const nodes = [...s.nodes, node];
      const fkEdges = edgesFromForeignKeys(nodes, s.edges);
      return {
        nodes,
        edges: fkEdges.length ? [...s.edges, ...fkEdges] : s.edges,
      };
    });
    return id;
  },

  applyPack: (tables, relations, origin) => {
    const ox = origin?.x ?? 80;
    const oy = origin?.y ?? 80;
    const cols = 3;
    const colW = 280;
    const rowH = 220;
    const idByName = new Map<string, string>();
    const nodes: SchemaNode[] = tables.map((t, i) => {
      const id = newId();
      idByName.set(t.tableName, id);
      return {
        id,
        type: "schemaTable",
        position: {
          x: ox + (i % cols) * colW,
          y: oy + Math.floor(i / cols) * rowH,
        },
        data: {
          tableName: t.tableName,
          columns: t.columns,
        } satisfies SchemaTableData,
      };
    });
    const explicit: SchemaEdge[] = relations
      .map((r) => {
        const source = idByName.get(r.from);
        const target = idByName.get(r.to);
        if (!source || !target) return null;
        return {
          id: newEdgeId(),
          source,
          target,
          type: "schemaRelation",
          data: { cardinality: r.cardinality, label: r.label },
        };
      })
      .filter(Boolean) as SchemaEdge[];

    withHistory(set, get, (s) => {
      const nextNodes = [...s.nodes, ...nodes];
      // Prefer parent → child for FK packs (from = parent in our templates)
      const nextEdges = withFkEdges(nextNodes, [...s.edges, ...explicit]);
      return { nodes: nextNodes, edges: nextEdges };
    });
    set((s) => ({ fitViewNonce: s.fitViewNonce + 1 }));
  },

  updateTable: (nodeId, patch) => {
    withHistory(set, get, (s) => {
      const nodes = s.nodes.map((n: SchemaNode) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      );
      // Re-wire FKs when columns change
      const baseEdges = s.edges.filter(
        (e: SchemaEdge) => !String(e.id).startsWith("rel-fk-")
      );
      return { nodes, edges: withFkEdges(nodes, baseEdges) };
    });
  },

  removeTable: (nodeId) => {
    withHistory(set, get, (s) => ({
      nodes: s.nodes.filter((n: SchemaNode) => n.id !== nodeId),
      edges: s.edges.filter(
        (e: SchemaEdge) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedTableId: s.selectedTableId === nodeId ? null : s.selectedTableId,
    }));
  },

  setGraph: (nodes, edges, opts) => {
    if (opts?.merge) {
      void import("@/lib/schema/schema-edges").then(({ mergeSchemaGraphs }) => {
        const s = get();
        const merged = mergeSchemaGraphs(s.nodes, s.edges, nodes, edges);
        withHistory(set, get, () => ({
          nodes: merged.nodes,
          edges: merged.edges,
          selectedTableId: null,
        }));
        set((st) => ({ fitViewNonce: st.fitViewNonce + 1 }));
      });
      return;
    }
    withHistory(set, get, () => ({
      nodes,
      edges: withFkEdges(nodes, edges),
      selectedTableId: null,
    }));
    set((s) => ({ fitViewNonce: s.fitViewNonce + 1 }));
  },

  setImportContext: (meta, connection, nodes, edges) => {
    set({
      importMeta: meta,
      sessionConnection: connection,
      baselineNodes: JSON.parse(JSON.stringify(nodes)),
      baselineEdges: JSON.parse(JSON.stringify(edges)),
    });
  },

  pushHistory: () => {
    const s = get();
    set({
      past: [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY),
      future: [],
    });
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: s.past.slice(0, -1),
      future: [cloneSnap(s.nodes, s.edges), ...s.future].slice(0, MAX_HISTORY),
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: s.future.slice(1),
      past: [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY),
    });
  },

  reset: () =>
    set({
      nodes: [],
      edges: [],
      selectedTableId: null,
      past: [],
      future: [],
      fitViewNonce: 0,
      importMeta: null,
      sessionConnection: null,
      baselineNodes: [],
      baselineEdges: [],
    }),

  requestFitView: () => set((s) => ({ fitViewNonce: s.fitViewNonce + 1 })),
}));
