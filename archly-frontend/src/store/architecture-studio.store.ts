/**
 * Architecture studio overlays — critique, blast, cost, eras, constraints, gallery.
 */

import { create } from "zustand";
import type { FlowEdge, FlowNode } from "@/store/flow.store";
import { useFlowStore } from "@/store/flow.store";
import { useStoryStore } from "@/store/story.store";

export type ArchOverlay =
  | null
  | "critique"
  | "blast"
  | "cost"
  | "eras"
  | "constraints";

export type BudgetTier = "none" | "low" | "mid" | "high";

export interface ArchConstraints {
  multiRegion: boolean;
  gdpr: boolean;
  p99Under200: boolean;
  budgetUnder: BudgetTier;
}

export interface ArchEra {
  id: string;
  label: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: number;
}

interface ArchitectureStudioStore {
  overlay: ArchOverlay;
  blastFocusNodeId: string | null;
  /** Compare era A vs B for diff highlight (node ids) */
  eraDiffFromId: string | null;
  eraDiffToId: string | null;
  constraints: ArchConstraints;
  eras: ArchEra[];
  activeEraId: string | null;
  galleryOpen: boolean;

  setOverlay: (overlay: ArchOverlay) => void;
  toggleOverlay: (overlay: Exclude<ArchOverlay, null>) => void;
  setBlastFocus: (nodeId: string | null) => void;
  setConstraints: (partial: Partial<ArchConstraints>) => void;
  snapshotEra: (label: string) => void;
  switchEra: (eraId: string) => void;
  setEraDiff: (fromId: string | null, toId: string | null) => void;
  deleteEra: (eraId: string) => void;
  setGalleryOpen: (open: boolean) => void;
  clearOverlay: () => void;
}

const DEFAULT_CONSTRAINTS: ArchConstraints = {
  multiRegion: false,
  gdpr: false,
  p99Under200: false,
  budgetUnder: "none",
};

export const useArchitectureStudioStore = create<ArchitectureStudioStore>()((set, get) => ({
  overlay: null,
  blastFocusNodeId: null,
  eraDiffFromId: null,
  eraDiffToId: null,
  constraints: { ...DEFAULT_CONSTRAINTS },
  eras: [],
  activeEraId: null,
  galleryOpen: false,

  setOverlay: (overlay) => {
    if (overlay) useStoryStore.getState().stop();
    set({
      overlay,
      blastFocusNodeId: overlay === "blast" ? useFlowStore.getState().selectedNodeId : null,
    });
  },

  toggleOverlay: (overlay) => {
    const cur = get().overlay;
    if (cur === overlay) {
      set({ overlay: null, blastFocusNodeId: null });
      return;
    }
    get().setOverlay(overlay);
  },

  setBlastFocus: (nodeId) => set({ blastFocusNodeId: nodeId }),

  setConstraints: (partial) =>
    set((s) => ({ constraints: { ...s.constraints, ...partial } })),

  snapshotEra: (label) => {
    const { nodes, edges } = useFlowStore.getState();
    const id = `era-${Date.now()}`;
    const era: ArchEra = {
      id,
      label: label.trim() || `Era ${get().eras.length + 1}`,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      createdAt: Date.now(),
    };
    set((s) => ({ eras: [...s.eras, era], activeEraId: id }));
  },

  switchEra: (eraId) => {
    const era = get().eras.find((e) => e.id === eraId);
    if (!era) return;
    useFlowStore.getState().loadGraph(era.nodes, era.edges);
    set({ activeEraId: eraId, overlay: "eras" });
  },

  setEraDiff: (fromId, toId) => set({ eraDiffFromId: fromId, eraDiffToId: toId }),

  deleteEra: (eraId) =>
    set((s) => ({
      eras: s.eras.filter((e) => e.id !== eraId),
      activeEraId: s.activeEraId === eraId ? null : s.activeEraId,
      eraDiffFromId: s.eraDiffFromId === eraId ? null : s.eraDiffFromId,
      eraDiffToId: s.eraDiffToId === eraId ? null : s.eraDiffToId,
    })),

  setGalleryOpen: (open) => {
    if (open) useStoryStore.getState().stop();
    set({ galleryOpen: open });
  },

  clearOverlay: () => set({ overlay: null, blastFocusNodeId: null }),
}));
