/**
 * Flow store — manages React Flow nodes and edges for the Flow canvas tab.
 * No top-level @xyflow/react import — avoids SSR bundle issues.
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

export interface FlowStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Currently selected node ID — read by PropertiesPanel */
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  onNodesChange: (changes: FlowNodeChange[]) => void;
  onEdgesChange: (changes: FlowEdgeChange[]) => void;
  onConnect:     (connection: FlowConnection) => void;
  addNode: (componentId: string, label: string, color: string, strokeColor: string, iconPath: string, position: XYPosition) => string;
  removeNode: (nodeId: string) => void;
  insertNodeOnEdge: (edgeId: string, componentId: string, label: string, color: string, strokeColor: string, iconPath: string, position: XYPosition) => string;
  updateNodeLabel: (nodeId: string, label: string) => void;
  reset: () => void;
}

let nodeCounter = 0;
const newId    = () => `node-${++nodeCounter}-${Date.now()}`;
const newEdgeId = () => `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useFlowStore = create<FlowStore>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  onNodesChange: (changes) =>
    set((s) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { applyNodeChanges } = require("@xyflow/react");
        return { nodes: applyNodeChanges(changes, s.nodes) };
      } catch { return s; }
    }),

  onEdgesChange: (changes) =>
    set((s) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { applyEdgeChanges } = require("@xyflow/react");
        return { edges: applyEdgeChanges(changes, s.edges) };
      } catch { return s; }
    }),

  onConnect: (connection) =>
    set((s) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { addEdge } = require("@xyflow/react");
        return { edges: addEdge({ ...connection, id: newEdgeId(), type: "flowEdge", animated: false }, s.edges) };
      } catch { return s; }
    }),

  addNode: (componentId, label, color, strokeColor, iconPath, position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "flowNode", position, data: { componentId, label, color, strokeColor, iconPath } }] }));
    return id;
  },

  removeNode: (nodeId) =>
    set((s) => ({
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
    set({
      nodes: [...nodes, { id: newNodeId, type: "flowNode", position, data: { componentId, label, color, strokeColor, iconPath } }],
      edges: [
        ...remaining,
        { id: newEdgeId(), source: edge.source, target: newNodeId, sourceHandle: edge.sourceHandle ?? undefined, type: "flowEdge" },
        { id: newEdgeId(), source: newNodeId, target: edge.target, targetHandle: edge.targetHandle ?? undefined, type: "flowEdge" },
      ],
    });
    return newNodeId;
  },

  updateNodeLabel: (nodeId, label) =>
    set((s) => ({ nodes: s.nodes.map((n: FlowNode) => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n) })),

  reset: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}));
