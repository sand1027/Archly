import { create } from "zustand";
import type { ExcalidrawElement, CollaboratorCursor } from "@/types";

// ─── Element sanitizer ────────────────────────────────────────────────────
// Excalidraw crashes with "Cannot read properties of undefined (reading 'length')"
// when elements have undefined array fields. This happens with mermaid-to-excalidraw
// output and collab sync. Sanitize at the store level so it's protected everywhere.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeElements(elements: any[]): ExcalidrawElement[] {
  if (!Array.isArray(elements)) return [];
  return elements
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => ({
      ...e,
      // Excalidraw calls .filter() on both of these — they must always be arrays
      groupIds:      Array.isArray(e?.groupIds)      ? e.groupIds      : [],
      boundElements: Array.isArray(e?.boundElements) ? e.boundElements : [],
      frameId:       e?.frameId  ?? null,
      link:          e?.link     ?? null,
      locked:        e?.locked   ?? false,
    })) as ExcalidrawElement[];
}

// ─── Node configuration (Infrastructure / Capacity / Patterns) ────────────

export interface NodeConfig {
  // Infrastructure
  replicas: number;
  cpuCores: string;
  cpuGhz: string;
  ramGb: string;
  diskReadIops: string;
  diskWriteIops: string;
  networkGbps: string;
  autoScale: "default" | "disabled" | "enabled" | "aggressive";

  // Capacity
  rpsCapacity: string;
  serviceLatencyMs: string;
  inspection: "default" | "none" | "basic" | "full";

  // Patterns
  cacheStrategy: "default" | "none" | "cache-aside" | "write-through" | "write-behind";
  retryPolicy: "default" | "none" | "fixed" | "exponential";
  circuitBreaker: "default" | "none" | "enabled";
  timeout: string;

  // Custom label override
  label: string;
}

export function defaultNodeConfig(label = ""): NodeConfig {
  return {
    replicas: 1,
    cpuCores: "default",
    cpuGhz: "default",
    ramGb: "default",
    diskReadIops: "default",
    diskWriteIops: "default",
    networkGbps: "default",
    autoScale: "default",
    rpsCapacity: "default",
    serviceLatencyMs: "default",
    inspection: "default",
    cacheStrategy: "default",
    retryPolicy: "default",
    circuitBreaker: "default",
    timeout: "default",
    label,
  };
}

// Minimal AppState shape we care about (Excalidraw's is huge)
export interface CanvasAppState {
  viewBackgroundColor: string;
  zoom: { value: number };
  scrollX: number;
  scrollY: number;
  theme: "light" | "dark";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface CanvasStore {
  // ── Elements ──────────────────────────────────────────────────────────
  elements: ExcalidrawElement[];
  setElements: (elements: ExcalidrawElement[]) => void;

  // ── App state (zoom, scroll, bg color) ────────────────────────────────
  appState: Partial<CanvasAppState>;
  setAppState: (appState: Partial<CanvasAppState>) => void;

  // ── Node configuration (Infrastructure/Capacity/Patterns per node) ───
  nodeConfigs: Record<string, NodeConfig>;
  setNodeConfig: (nodeId: string, config: Partial<NodeConfig>) => void;
  getNodeConfig: (nodeId: string, label?: string) => NodeConfig;
  removeNodeConfig: (nodeId: string) => void;

  // ── Collaboration ──────────────────────────────────────────────────────
  collaborators: Map<string, CollaboratorCursor>;
  setCollaborator: (cursor: CollaboratorCursor) => void;
  removeCollaborator: (userId: string) => void;

  // ── Active room ────────────────────────────────────────────────────────
  roomId: string | null;
  setRoomId: (id: string | null) => void;

  // ── Selected element IDs (for properties panel + chaos target) ────────
  selectedElementIds: string[];
  setSelectedElementIds: (ids: string[]) => void;

  // ── Dirty flag (unsaved changes) ──────────────────────────────────────
  isDirty: boolean;
  markDirty: () => void;
  markClean: () => void;

  // ── Reset ──────────────────────────────────────────────────────────────
  reset: () => void;
}

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
    elements: [],
    setElements: (elements) => set((s) => {
      const safe = sanitizeElements(elements as unknown[]);
      if (s.elements === elements) return {};
      return { elements: safe, isDirty: true };
    }),

    appState: { viewBackgroundColor: "#ffffff", theme: "light" },
    setAppState: (appState) => set((s) => ({ appState: { ...s.appState, ...appState } })),

    nodeConfigs: {},
    setNodeConfig: (nodeId, config) =>
      set((s) => ({
        nodeConfigs: {
          ...s.nodeConfigs,
          [nodeId]: { ...(s.nodeConfigs[nodeId] ?? defaultNodeConfig()), ...config },
        },
        isDirty: true,
      })),
    getNodeConfig: (nodeId, label = "") => get().nodeConfigs[nodeId] ?? defaultNodeConfig(label),
    removeNodeConfig: (nodeId) =>
      set((s) => {
        const next = { ...s.nodeConfigs };
        delete next[nodeId];
        return { nodeConfigs: next };
      }),

    collaborators: new Map(),
    setCollaborator: (cursor) =>
      set((s) => {
        const next = new Map(s.collaborators);
        next.set(cursor.userId, cursor);
        return { collaborators: next };
      }),
    removeCollaborator: (userId) =>
      set((s) => {
        const next = new Map(s.collaborators);
        next.delete(userId);
        return { collaborators: next };
      }),

    roomId: null,
    setRoomId: (id) => set({ roomId: id }),

    selectedElementIds: [],
    setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),

    isDirty: false,
    markDirty: () => set({ isDirty: true }),
    markClean: () => set({ isDirty: false }),

    reset: () =>
      set({
        elements: [],
        appState: { viewBackgroundColor: "#ffffff", theme: "light" },
        nodeConfigs: {},
        collaborators: new Map(),
        roomId: null,
        selectedElementIds: [],
        isDirty: false,
      }),
}));
