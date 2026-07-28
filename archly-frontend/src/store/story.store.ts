/**
 * Architecture Story walkthrough state — hop-by-hop path on Flow.
 */

import { create } from "zustand";
import {
  findShortestPath,
  getBranchOptions,
  hopLatencyMs,
  narrateHop,
  pickDefaultEndId,
  pickDefaultStartId,
  rebuildPathAfterBranch,
  type BranchOption,
  type StoryMode,
} from "@/lib/architecture/story-path";
import { useFlowStore } from "@/store/flow.store";

const AUTO_MS = 2500;

interface StoryStore {
  active: boolean;
  startId: string | null;
  endId: string | null;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  hopIndex: number;
  playing: boolean;
  mode: StoryMode;
  /** Waiting for user to pick outbound branch */
  pendingBranches: BranchOption[];
  autoAdvance: boolean;

  activate: (opts?: { startId?: string; endId?: string }) => void;
  stop: () => void;
  setMode: (mode: StoryMode) => void;
  setStartId: (id: string) => void;
  setEndId: (id: string) => void;
  rebuildPath: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  chooseBranch: (edgeId: string) => void;
  setAutoAdvance: (v: boolean) => void;
  /** Edge currently animating the story packet (between hopIndex and hopIndex+1) */
  currentStoryEdgeId: () => string | null;
  cumulativeLatencyMs: () => number;
  totalLatencyMs: () => number;
  narration: () => { title: string; body: string } | null;
  isComplete: () => boolean;
}

let autoTimer: ReturnType<typeof setTimeout> | null = null;

function clearAuto() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function scheduleAuto(get: () => StoryStore) {
  clearAuto();
  const s = get();
  if (!s.playing || !s.autoAdvance || !s.active) return;
  if (s.pendingBranches.length) return;
  if (s.hopIndex >= s.pathNodeIds.length - 1) {
    get().pause();
    return;
  }
  autoTimer = setTimeout(() => {
    get().next();
  }, AUTO_MS);
}

function branchesAtHop(
  pathNodeIds: string[],
  pathEdgeIds: string[],
  hopIndex: number
): BranchOption[] {
  const { nodes, edges } = useFlowStore.getState();
  const nodeId = pathNodeIds[hopIndex];
  if (!nodeId) return [];
  const nextEdge = pathEdgeIds[hopIndex] ?? null;
  const opts = getBranchOptions(nodes, edges, nodeId, nextEdge);
  // Only pause for choice when there are real alternatives (2+)
  return opts.length >= 2 ? opts : [];
}

export const useStoryStore = create<StoryStore>()((set, get) => ({
  active: false,
  startId: null,
  endId: null,
  pathNodeIds: [],
  pathEdgeIds: [],
  hopIndex: 0,
  playing: false,
  mode: "happy",
  pendingBranches: [],
  autoAdvance: true,

  activate: (opts) => {
    const { nodes } = useFlowStore.getState();
    if (!nodes.length) return;
    const startId = opts?.startId ?? pickDefaultStartId(nodes);
    const endId = opts?.endId ?? pickDefaultEndId(nodes, startId);
    if (!startId) return;
    set({
      active: true,
      startId,
      endId,
      hopIndex: 0,
      playing: false,
      pendingBranches: [],
    });
    get().rebuildPath();
    useFlowStore.getState().setSelectedNodeId(startId);
    useFlowStore.getState().requestFitView();
  },

  stop: () => {
    clearAuto();
    set({
      active: false,
      playing: false,
      pathNodeIds: [],
      pathEdgeIds: [],
      hopIndex: 0,
      pendingBranches: [],
      startId: null,
      endId: null,
    });
  },

  setMode: (mode) => {
    set({ mode });
  },

  setStartId: (id) => {
    set({ startId: id });
    get().rebuildPath();
    set({ hopIndex: 0, playing: false, pendingBranches: [] });
    clearAuto();
  },

  setEndId: (id) => {
    set({ endId: id });
    get().rebuildPath();
    set({ hopIndex: 0, playing: false, pendingBranches: [] });
    clearAuto();
  },

  rebuildPath: () => {
    const { nodes, edges } = useFlowStore.getState();
    const { startId, endId } = get();
    if (!startId) {
      set({ pathNodeIds: [], pathEdgeIds: [] });
      return;
    }
    const path = findShortestPath(nodes, edges, startId, endId);
    if (!path) {
      set({ pathNodeIds: [startId], pathEdgeIds: [], pendingBranches: [] });
      return;
    }
    set({
      pathNodeIds: path.nodeIds,
      pathEdgeIds: path.edgeIds,
      pendingBranches: branchesAtHop(path.nodeIds, path.edgeIds, 0),
    });
  },

  play: () => {
    const s = get();
    if (!s.active || s.pathNodeIds.length < 2) return;
    if (s.hopIndex >= s.pathNodeIds.length - 1) {
      set({ hopIndex: 0, pendingBranches: branchesAtHop(s.pathNodeIds, s.pathEdgeIds, 0) });
    }
    set({ playing: true });
    const cur = get().pathNodeIds[get().hopIndex];
    if (cur) useFlowStore.getState().setSelectedNodeId(cur);
    scheduleAuto(get);
  },

  pause: () => {
    clearAuto();
    set({ playing: false });
  },

  next: () => {
    const s = get();
    if (!s.active) return;

    if (s.pendingBranches.length && s.playing) {
      // Must choose branch before advancing
      return;
    }

    const nextIdx = Math.min(s.hopIndex + 1, s.pathNodeIds.length - 1);
    if (nextIdx === s.hopIndex && nextIdx >= s.pathNodeIds.length - 1) {
      get().pause();
      return;
    }

    const pending = branchesAtHop(s.pathNodeIds, s.pathEdgeIds, nextIdx);
    set({ hopIndex: nextIdx, pendingBranches: pending });
    const nid = s.pathNodeIds[nextIdx];
    if (nid) useFlowStore.getState().setSelectedNodeId(nid);

    if (nextIdx >= s.pathNodeIds.length - 1) {
      get().pause();
      return;
    }
    if (pending.length) {
      // Pause for branch choice
      clearAuto();
      set({ playing: true }); // stay "in story" but wait
      return;
    }
    if (get().playing) scheduleAuto(get);
  },

  prev: () => {
    clearAuto();
    const s = get();
    const prevIdx = Math.max(0, s.hopIndex - 1);
    const pending = branchesAtHop(s.pathNodeIds, s.pathEdgeIds, prevIdx);
    set({ hopIndex: prevIdx, pendingBranches: pending, playing: false });
    const nid = s.pathNodeIds[prevIdx];
    if (nid) useFlowStore.getState().setSelectedNodeId(nid);
  },

  restart: () => {
    clearAuto();
    const s = get();
    const pending = branchesAtHop(s.pathNodeIds, s.pathEdgeIds, 0);
    set({ hopIndex: 0, pendingBranches: pending, playing: false });
    const nid = s.pathNodeIds[0];
    if (nid) useFlowStore.getState().setSelectedNodeId(nid);
  },

  chooseBranch: (edgeId) => {
    const s = get();
    const { nodes, edges } = useFlowStore.getState();
    const rebuilt = rebuildPathAfterBranch(
      nodes,
      edges,
      s.pathNodeIds,
      s.hopIndex,
      edgeId,
      s.endId
    );
    if (!rebuilt) return;
    const nextIdx = Math.min(s.hopIndex + 1, rebuilt.nodeIds.length - 1);
    const pending = branchesAtHop(rebuilt.nodeIds, rebuilt.edgeIds, nextIdx);
    set({
      pathNodeIds: rebuilt.nodeIds,
      pathEdgeIds: rebuilt.edgeIds,
      hopIndex: nextIdx,
      pendingBranches: pending,
    });
    const nid = rebuilt.nodeIds[nextIdx];
    if (nid) useFlowStore.getState().setSelectedNodeId(nid);
    if (get().playing && !pending.length) scheduleAuto(get);
  },

  setAutoAdvance: (v) => {
    set({ autoAdvance: v });
    if (v && get().playing) scheduleAuto(get);
    else clearAuto();
  },

  currentStoryEdgeId: () => {
    const s = get();
    if (!s.active || s.hopIndex >= s.pathEdgeIds.length) return null;
    // Packet travels on the edge *into* the current hop (from previous)
    if (s.hopIndex === 0) return null;
    return s.pathEdgeIds[s.hopIndex - 1] ?? null;
  },

  cumulativeLatencyMs: () => {
    const { nodes } = useFlowStore.getState();
    const s = get();
    let sum = 0;
    for (let i = 0; i <= s.hopIndex && i < s.pathNodeIds.length; i++) {
      const n = nodes.find((x) => x.id === s.pathNodeIds[i]);
      sum += hopLatencyMs(n?.data?.componentId);
    }
    return sum;
  },

  totalLatencyMs: () => {
    const { nodes } = useFlowStore.getState();
    const s = get();
    let sum = 0;
    for (const id of s.pathNodeIds) {
      const n = nodes.find((x) => x.id === id);
      sum += hopLatencyMs(n?.data?.componentId);
    }
    return sum || 1;
  },

  narration: () => {
    const { nodes } = useFlowStore.getState();
    const s = get();
    if (!s.active || !s.pathNodeIds.length) return null;
    const i = s.hopIndex;
    const node = nodes.find((n) => n.id === s.pathNodeIds[i]);
    const prev = i > 0 ? nodes.find((n) => n.id === s.pathNodeIds[i - 1]) : undefined;
    const next =
      i < s.pathNodeIds.length - 1
        ? nodes.find((n) => n.id === s.pathNodeIds[i + 1])
        : undefined;
    return narrateHop(node, prev, next, s.mode, i, s.pathNodeIds.length);
  },

  isComplete: () => {
    const s = get();
    return s.active && s.pathNodeIds.length > 1 && s.hopIndex >= s.pathNodeIds.length - 1;
  },
}));
