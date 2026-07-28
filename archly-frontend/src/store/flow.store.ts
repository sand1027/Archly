/**
 * Flow store — manages React Flow nodes and edges for the Flow canvas tab.
 * No top-level @xyflow/react import — avoids SSR bundle issues.
 * Undo/redo stacks survive Canvas/Flow tab switches (store is module-scoped).
 */

import { create } from "zustand";

export interface XYPosition { x: number; y: number; }
export interface FlowNodeChange { type: string; id?: string; [key: string]: unknown; }
export interface FlowEdgeChange { type: string; id?: string; [key: string]: unknown; }
export interface FlowConnection {
  source: string; target: string;
  sourceHandle?: string | null; targetHandle?: string | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FlowNode = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FlowEdge = any;

export interface FlowNodeData {
  componentId: string; label: string;
  color: string; strokeColor: string; iconPath: string;
  [key: string]: unknown;
}

interface FlowSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const MAX_HISTORY = 50;

function cloneSnap(nodes: FlowNode[], edges: FlowEdge[]): FlowSnapshot {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

export interface FlowStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Currently selected node ID — read by PropertiesPanel */
  selectedNodeId: string | null;
  past: FlowSnapshot[];
  future: FlowSnapshot[];
  setSelectedNodeId: (id: string | null) => void;
  onNodesChange: (changes: FlowNodeChange[]) => void;
  onEdgesChange: (changes: FlowEdgeChange[]) => void;
  onConnect:     (connection: FlowConnection) => void;
  addNode: (componentId: string, label: string, color: string, strokeColor: string, iconPath: string, position: XYPosition) => string;
  removeNode: (nodeId: string) => void;
  insertNodeOnEdge: (edgeId: string, componentId: string, label: string, color: string, strokeColor: string, iconPath: string, position: XYPosition) => string;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateEdgeData: (edgeId: string, data: Record<string, unknown>) => void;
  /** Replace graph (gallery fork, eras, promote). Pushes history. */
  loadGraph: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  /** Bumped to ask FlowCanvas to fitView (center) the graph */
  fitViewNonce: number;
  requestFitView: () => void;
}

let nodeCounter = 0;
const newId    = () => `node-${++nodeCounter}-${Date.now()}`;
const newEdgeId = () => `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function withHistory(
  set: (fn: (s: FlowStore) => Partial<FlowStore>) => void,
  get: () => FlowStore,
  mutator: (s: FlowStore) => Partial<FlowStore>
) {
  const s = get();
  const past = [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY);
  set(() => ({ ...mutator(s), past, future: [] }));
}

export const useFlowStore = create<FlowStore>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],
  fitViewNonce: 0,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  requestFitView: () => set((s) => ({ fitViewNonce: s.fitViewNonce + 1 })),

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
      past: s.past.slice(0, -1),
      future: [cloneSnap(s.nodes, s.edges), ...s.future].slice(0, MAX_HISTORY),
      nodes: prev.nodes,
      edges: prev.edges,
      selectedNodeId: null,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({
      future: s.future.slice(1),
      past: [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY),
      nodes: next.nodes,
      edges: next.edges,
      selectedNodeId: null,
    });
  },

  onNodesChange: (changes) =>
    set((s) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { applyNodeChanges } = require("@xyflow/react");
        // Don't push history for selection/position drag micro-updates of type "select"
        const structural = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        const next = applyNodeChanges(changes, s.nodes);
        if (structural) {
          return {
            nodes: next,
            past: [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY),
            future: [],
          };
        }
        return { nodes: next };
      } catch { return s; }
    }),

  onEdgesChange: (changes) =>
    set((s) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { applyEdgeChanges } = require("@xyflow/react");
        const structural = changes.some(
          (c) => c.type === "remove" || c.type === "add" || c.type === "replace"
        );
        const next = applyEdgeChanges(changes, s.edges);
        if (structural) {
          return {
            edges: next,
            past: [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY),
            future: [],
          };
        }
        return { edges: next };
      } catch { return s; }
    }),

  onConnect: (connection) =>
    withHistory(set, get, (s) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { addEdge } = require("@xyflow/react");
        return { edges: addEdge({ ...connection, id: newEdgeId(), type: "flowEdge", animated: false }, s.edges) };
      } catch { return {}; }
    }),

  addNode: (componentId, label, color, strokeColor, iconPath, position) => {
    const id = newId();
    withHistory(set, get, (s) => ({
      nodes: [...s.nodes, { id, type: "flowNode", position, data: { componentId, label, color, strokeColor, iconPath } }],
    }));
    return id;
  },

  removeNode: (nodeId) =>
    withHistory(set, get, (s) => ({
      nodes: s.nodes.filter((n: FlowNode) => n.id !== nodeId),
      edges: s.edges.filter((e: FlowEdge) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    })),

  insertNodeOnEdge: (edgeId, componentId, label, color, strokeColor, iconPath, position) => {
    const { edges, nodes } = get();
    const edge = edges.find((e: FlowEdge) => e.id === edgeId);
    if (!edge) return "";
    const newNodeId = newId();
    const remaining = edges.filter((e: FlowEdge) => e.id !== edgeId);
    withHistory(set, get, () => ({
      nodes: [...nodes, { id: newNodeId, type: "flowNode", position, data: { componentId, label, color, strokeColor, iconPath } }],
      edges: [
        ...remaining,
        { id: newEdgeId(), source: edge.source, target: newNodeId, sourceHandle: edge.sourceHandle ?? undefined, type: "flowEdge" },
        { id: newEdgeId(), source: newNodeId, target: edge.target, targetHandle: edge.targetHandle ?? undefined, type: "flowEdge" },
      ],
    }));
    return newNodeId;
  },

  updateNodeLabel: (nodeId, label) =>
    withHistory(set, get, (s) => ({
      nodes: s.nodes.map((n: FlowNode) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      ),
    })),

  updateEdgeData: (edgeId, data) =>
    withHistory(set, get, (s) => ({
      edges: s.edges.map((e: FlowEdge) =>
        e.id === edgeId
          ? { ...e, data: { ...(e.data ?? {}), ...data } }
          : e
      ),
    })),

  loadGraph: (nodes, edges) => {
    const s = get();
    set({
      past: [...s.past, cloneSnap(s.nodes, s.edges)].slice(-MAX_HISTORY),
      future: [],
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      selectedNodeId: null,
      fitViewNonce: s.fitViewNonce + 1,
    });
  },

  reset: () => set({ nodes: [], edges: [], selectedNodeId: null, past: [], future: [], fitViewNonce: 0 }),
}));
