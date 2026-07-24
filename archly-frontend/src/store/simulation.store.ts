import { create } from "zustand";
import type {
  SimPacket,
  NodeMetrics,
  ChaosInjection,
  ChaosType,
  BottleneckEntry,
} from "@/types";

export interface SimulationStore {
  // ── Run state ──────────────────────────────────────────────────────────
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;

  // ── Config ─────────────────────────────────────────────────────────────
  trafficMultiplier: number;   // 0.1 – 5.0
  speed: number;               // 0.5 – 3.0 (animation speed)
  setTrafficMultiplier: (v: number) => void;
  setSpeed: (v: number) => void;

  // ── Packets (live animated dots) ───────────────────────────────────────
  packets: SimPacket[];
  addPacket: (packet: SimPacket) => void;
  updatePackets: (packets: SimPacket[]) => void;
  removePacket: (id: string) => void;

  // ── Per-node metrics ───────────────────────────────────────────────────
  metrics: Record<string, NodeMetrics>;   // keyed by nodeId
  setMetrics: (metrics: Record<string, NodeMetrics>) => void;
  updateNodeMetrics: (nodeId: string, m: Partial<NodeMetrics>) => void;

  // ── Bottleneck ranking ─────────────────────────────────────────────────
  bottlenecks: BottleneckEntry[];
  setBottlenecks: (b: BottleneckEntry[]) => void;

  // ── Chaos ──────────────────────────────────────────────────────────────
  activeInjections: ChaosInjection[];
  pendingChaosType: ChaosType | null;   // waiting for user to pick a target node
  setPendingChaosType: (type: ChaosType | null) => void;
  injectChaos: (injection: ChaosInjection) => void;
  removeChaos: (id: string) => void;
  clearAllChaos: () => void;
  hasChaosOnNode: (nodeId: string) => boolean;

  // ── Simulation run count (free tier gate) ─────────────────────────────
  runCount: number;
  incrementRunCount: () => void;

  // ── Reset ──────────────────────────────────────────────────────────────
  reset: () => void;
}

export const useSimulationStore = create<SimulationStore>()((set, get) => ({
    isRunning: false,
    start: () => {
      set({ isRunning: true });
      get().incrementRunCount();
    },
    stop: () => set({ isRunning: false }),
    toggle: () => {
      if (get().isRunning) get().stop();
      else get().start();
    },

    trafficMultiplier: 1.0,
    speed: 1.0,
    setTrafficMultiplier: (v) => set({ trafficMultiplier: Math.min(5, Math.max(0.1, v)) }),
    setSpeed: (v) => set({ speed: Math.min(3, Math.max(0.5, v)) }),

    packets: [],
    addPacket: (packet) => set((s) => ({ packets: [...s.packets, packet] })),
    updatePackets: (packets) => set({ packets }),
    removePacket: (id) =>
      set((s) => ({ packets: s.packets.filter((p) => p.id !== id) })),

    metrics: {},
    setMetrics: (metrics) => set({ metrics }),
    updateNodeMetrics: (nodeId, m) =>
      set((s) => ({
        metrics: {
          ...s.metrics,
          [nodeId]: { ...(s.metrics[nodeId] ?? {}), ...m } as NodeMetrics,
        },
      })),

    bottlenecks: [],
    setBottlenecks: (bottlenecks) => set({ bottlenecks }),

    activeInjections: [],
    pendingChaosType: null,
    setPendingChaosType: (type) => set({ pendingChaosType: type }),
    injectChaos: (injection) =>
      set((s) => ({ activeInjections: [...s.activeInjections, injection] })),
    removeChaos: (id) =>
      set((s) => ({
        activeInjections: s.activeInjections.filter((i) => i.id !== id),
      })),
    clearAllChaos: () => set({ activeInjections: [] }),
    hasChaosOnNode: (nodeId) =>
      get().activeInjections.some((i) => i.nodeId === nodeId),

    runCount: 0,
    incrementRunCount: () => set((s) => ({ runCount: s.runCount + 1 })),

    reset: () =>
      set({
        isRunning: false,
        packets: [],
        metrics: {},
        bottlenecks: [],
        activeInjections: [],
        pendingChaosType: null,
        runCount: 0,
      }),
}));
