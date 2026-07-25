/**
 * Snapshot + hydrate helpers for saving and reopening Canvas/Flow sessions.
 *
 * Canvas sessions store Excalidraw `elements` + `app_state`.
 * Flow sessions store `{ nodes, edges }` inside `elements`.
 * Per-node config (nodeConfigs) lives in the canvas store for both tabs and
 * is preserved under `app_state.nodeConfigs`.
 */

import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { useCanvasStore } from "@/store/canvas.store";
import { useFlowStore } from "@/store/flow.store";
import { useSimulationStore } from "@/store/simulation.store";
import type { DesignKind, ExcalidrawElement, SavedDesign } from "@/types";

export type CanvasTabKind = DesignKind;

export interface SessionSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app_state: Record<string, any>;
}

/** True when the active tab has no meaningful content worth saving. */
export function isActiveEmpty(kind: CanvasTabKind): boolean {
  if (kind === "flow") {
    return useFlowStore.getState().nodes.length === 0;
  }
  const api = getExcalidrawAPI();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const els = (api?.getSceneElements?.() as any[]) ?? useCanvasStore.getState().elements;
  return !els.some((e) => !e.isDeleted);
}

const DRAFT_KEY = "archly-session-draft";

/** Build a serialisable snapshot of the active tab. */
export function snapshotActive(kind: CanvasTabKind): SessionSnapshot {
  const nodeConfigs = useCanvasStore.getState().nodeConfigs;
  const chaos = useSimulationStore.getState().activeInjections;

  if (kind === "flow") {
    const { nodes, edges } = useFlowStore.getState();
    return {
      elements: { nodes, edges },
      app_state: { nodeConfigs, chaos },
    };
  }

  const api = getExcalidrawAPI();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (api?.getSceneElements?.() as any[]) ?? useCanvasStore.getState().elements;
  const elements = raw.filter((e) => !e.isDeleted);
  const appState = useCanvasStore.getState().appState;

  return {
    elements,
    app_state: { ...appState, nodeConfigs, chaos },
  };
}

/** Persist a crash-recovery draft to localStorage. */
export function writeLocalDraft(
  kind: CanvasTabKind,
  snapshot: SessionSnapshot,
  sessionId?: string | null
): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        kind,
        sessionId: sessionId ?? null,
        savedAt: Date.now(),
        ...snapshot,
      })
    );
  } catch {
    // quota / private mode — ignore
  }
}

export function readLocalDraft(): {
  kind: CanvasTabKind;
  sessionId: string | null;
  savedAt: number;
  elements: unknown;
  app_state: Record<string, unknown>;
} | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function clearActive(kind: CanvasTabKind) {
  useSimulationStore.getState().clearAllChaos();
  useSimulationStore.getState().stop();
  useSimulationStore.getState().setMetrics({});
  useSimulationStore.getState().updatePackets([]);
  useSimulationStore.getState().setBottlenecks([]);

  const configs = useCanvasStore.getState().nodeConfigs;
  for (const id of Object.keys(configs)) {
    useCanvasStore.getState().removeNodeConfig(id);
  }

  if (kind === "flow") {
    useFlowStore.getState().reset();
    return;
  }

  const api = getExcalidrawAPI();
  api?.updateScene?.({ elements: [] });
  api?.history?.clear?.();
  useCanvasStore.getState().setElements([]);
  useCanvasStore.getState().setSelectedElementIds([]);
}

function restoreNodeConfigs(appState: Record<string, unknown> | null | undefined) {
  const configs = (appState?.nodeConfigs ?? {}) as Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
  for (const [id, cfg] of Object.entries(configs)) {
    useCanvasStore.getState().setNodeConfig(id, cfg);
  }
}

function restoreChaos(appState: Record<string, unknown> | null | undefined) {
  const chaos = appState?.chaos;
  if (!Array.isArray(chaos) || chaos.length === 0) return;
  const sim = useSimulationStore.getState();
  sim.clearAllChaos();
  for (const inj of chaos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = inj as any;
    if (!item?.id || !item?.type || !item?.nodeId) continue;
    sim.injectChaos({
      id: String(item.id),
      type: item.type,
      nodeId: String(item.nodeId),
      params: item.params ?? {},
      injectedAt: item.injectedAt ?? Date.now(),
    });
  }
}

/**
 * Replace the active canvas with a saved design. Switches nothing itself —
 * the caller is responsible for activating the matching tab first.
 */
export function hydrateDesign(design: SavedDesign): void {
  const kind: CanvasTabKind = design.kind === "flow" ? "flow" : "canvas";
  clearActive(kind);
  restoreNodeConfigs(design.app_state);

  if (kind === "flow") {
    const payload = (design.elements ?? {}) as {
      nodes?: unknown[];
      edges?: unknown[];
    };
    useFlowStore.setState({
      nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
      edges: Array.isArray(payload.edges) ? payload.edges : [],
      selectedNodeId: null,
      past: [],
      future: [],
    });
    useFlowStore.getState().requestFitView();
    restoreChaos(design.app_state);
    useCanvasStore.getState().markClean();
    clearLocalDraft();
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements = (Array.isArray(design.elements) ? design.elements : []) as ExcalidrawElement[];
  const api = getExcalidrawAPI();
  if (api) {
    api.updateScene({ elements });
    setTimeout(() => api.scrollToContent?.(), 60);
  } else {
    useCanvasStore.getState().setElements(elements);
  }
  useCanvasStore.getState().setSelectedElementIds([]);
  restoreChaos(design.app_state);
  useCanvasStore.getState().markClean();
  clearLocalDraft();
}

/** Hydrate from a local draft blob (same shape as SavedDesign fields). */
export function hydrateSnapshot(
  kind: CanvasTabKind,
  elements: unknown,
  app_state: Record<string, unknown>
): void {
  hydrateDesign({
    id: "draft",
    user_id: "",
    title: "Draft",
    description: "",
    elements,
    app_state,
    tags: [],
    published: false,
    kind,
    created_at: "",
    updated_at: "",
  });
}
