/**
 * Client-side simulation engine.
 *
 * Runs a requestAnimationFrame loop that:
 * 1. Reads Excalidraw elements from the canvas store
 * 2. Identifies "node" elements (system design components) and "edge" elements (arrows)
 * 3. Spawns animated packets along edges at a rate proportional to trafficMultiplier
 * 4. Advances packet positions each frame
 * 5. Calculates per-node metrics and bottleneck rankings
 * 6. Writes everything back to the simulation store
 *
 * All logic is synchronous per-frame — no async, no backend calls.
 */

import { nanoid } from "nanoid";
import { calculateNodeMetrics, rankBottlenecks } from "./metrics";
import { useSimulationStore } from "@/store/simulation.store";
import { useCanvasStore } from "@/store/canvas.store";
import type { SimPacket, NodeMetrics, ExcalidrawElement } from "@/types";

// Lazy reference to flow store — avoids circular dependency at module load time
// Uses a function that only runs in browser (not during SSR/engine init)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _flowStore: any = null;
function getFlowNodes(): { id: string; position: { x: number; y: number }; data: Record<string, unknown> }[] {
  if (typeof window === "undefined") return []; // SSR guard — never runs on server
  if (!_flowStore) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _flowStore = require("@/store/flow.store").useFlowStore;
    } catch { return []; }
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return (_flowStore.getState()?.nodes as unknown[]) as { id: string; position: { x: number; y: number }; data: Record<string, unknown> }[] ?? [];
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** How many packets to spawn per edge per second at 1× traffic */
const BASE_PACKETS_PER_SECOND = 2;

/** Max packets alive at once (performance cap) */
const MAX_PACKETS = 300;

/** Packet travel time at 1× speed (ms) */
const BASE_TRAVEL_MS = 1200;

// ─── Engine state (module-level, not in React state) ──────────────────────

let rafHandle: number | null = null;
let lastFrameTime = 0;
let spawnAccumulators: Record<string, number> = {}; // edgeId → accumulated time

// ─── Public API ────────────────────────────────────────────────────────────

export function startSimulationLoop(): void {
  if (rafHandle !== null) return; // already running
  lastFrameTime = performance.now();
  spawnAccumulators = {};
  rafHandle = requestAnimationFrame(tick);
}

export function stopSimulationLoop(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
  // Clear packets on stop
  useSimulationStore.getState().updatePackets([]);
}

// ─── Frame tick ────────────────────────────────────────────────────────────

function tick(now: number): void {
  const { isRunning } = useSimulationStore.getState();
  if (!isRunning) {
    rafHandle = null;
    return;
  }

  const dt = Math.min(now - lastFrameTime, 100); // cap at 100ms (tab hidden)
  lastFrameTime = now;

  const { trafficMultiplier, speed, activeInjections } =
    useSimulationStore.getState();
  const { elements } = useCanvasStore.getState();

  // Classify elements
  const nodes  = elements.filter(isNodeElement);
  const edges  = elements.filter(isEdgeElement);

  // ── Advance existing packets ────────────────────────────────────────

  const existing = useSimulationStore.getState().packets;
  const travelMs = BASE_TRAVEL_MS / speed;

  const advanced = existing
    .map((p) => ({
      ...p,
      progress: p.progress + dt / travelMs,
    }))
    .filter((p) => p.progress < 1);

  // ── Spawn new packets ───────────────────────────────────────────────

  const newPackets: SimPacket[] = [];

  if (advanced.length < MAX_PACKETS) {
    for (const edge of edges) {
      const fromId = getEdgeSourceId(edge);
      const toId   = getEdgeTargetId(edge);
      if (!fromId || !toId) continue;

      const fromNode = nodes.find((n) => n.id === fromId);
      const toNode   = nodes.find((n) => n.id === toId);
      if (!fromNode || !toNode) continue;

      // Accumulate time for this edge
      const key = edge.id;
      spawnAccumulators[key] = (spawnAccumulators[key] ?? 0) + dt;

      const intervalMs =
        1000 / (BASE_PACKETS_PER_SECOND * trafficMultiplier * speed);

      while (
        spawnAccumulators[key] >= intervalMs &&
        advanced.length + newPackets.length < MAX_PACKETS
      ) {
        spawnAccumulators[key] -= intervalMs;

        // Check if source node has chaos that causes errors
        const srcInjections = activeInjections.filter(
          (i) => i.nodeId === fromId
        );
        const isError =
          srcInjections.some((i) => i.type === "crash") ||
          (srcInjections.some((i) => i.type === "slow" || i.type === "surge") &&
            Math.random() < 0.15);

        newPackets.push({
          id:         nanoid(8),
          fromNodeId: fromId,
          toNodeId:   toId,
          progress:   0,
          isError,
          createdAt:  now,
        });
      }
    }
  }

  const nextPackets = [...advanced, ...newPackets];
  useSimulationStore.getState().updatePackets(nextPackets);

  // ── Recalculate metrics (every 8 frames ~120ms) ─────────────────────

  if (Math.floor(now / 120) !== Math.floor(lastFrameTime / 120)) {
    const metrics: Record<string, NodeMetrics> = {};

    // Metrics for Excalidraw elements (canvas tab)
    for (const node of nodes) {
      metrics[node.id] = calculateNodeMetrics(
        node,
        trafficMultiplier,
        activeInjections
      );
    }

    // Metrics for React Flow nodes (flow tab)
    const flowNodes = getFlowNodes();
    for (const fn of flowNodes) {
      if (!metrics[fn.id]) {
        const synth = {
          id: fn.id, type: "rectangle",
          customData: { componentId: (fn.data?.componentId as string) ?? "" },
          isDeleted: false,
          x: fn.position.x, y: fn.position.y, width: 160, height: 80,
          // minimal required fields for calculateNodeMetrics
          angle: 0, strokeColor: "#000", backgroundColor: "#fff",
          fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
          roughness: 1, opacity: 100, groupIds: [], roundness: null,
          version: 1, versionNonce: 0, updated: 0, link: null, locked: false,
          frameId: null, boundElements: null, index: null, seed: 0,
        } as unknown as ExcalidrawElement;
        metrics[fn.id] = calculateNodeMetrics(synth, trafficMultiplier, activeInjections);
      }
    }

    useSimulationStore.getState().setMetrics(metrics);
    useSimulationStore.getState().setBottlenecks(rankBottlenecks(metrics));
  }

  rafHandle = requestAnimationFrame(tick);
}

// ─── Element classification helpers ────────────────────────────────────────

/**
 * A "node" is any Excalidraw element that has a componentId in customData,
 * or is a rectangle/ellipse (generic shape on the canvas).
 */
function isNodeElement(el: ExcalidrawElement): boolean {
  if (el.isDeleted) return false;
  if (el.customData?.componentId) return true;
  return el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond";
}

/**
 * An "edge" is an arrow element with both a start and end binding.
 */
function isEdgeElement(el: ExcalidrawElement): boolean {
  if (el.isDeleted) return false;
  return (
    el.type === "arrow" &&
    el.startBinding != null &&
    el.endBinding != null
  );
}

function getEdgeSourceId(el: ExcalidrawElement): string | null {
  return (el.startBinding as { elementId?: string } | null)?.elementId ?? null;
}

function getEdgeTargetId(el: ExcalidrawElement): string | null {
  return (el.endBinding as { elementId?: string } | null)?.elementId ?? null;
}

// ─── Packet position resolver ──────────────────────────────────────────────

/**
 * Given a packet and the canvas elements, compute the pixel position
 * of the packet along the line from source center → target center.
 *
 * Used by PacketAnimator to position the SVG dot overlay.
 */
export function getPacketPosition(
  packet: SimPacket,
  elements: ExcalidrawElement[]
): { x: number; y: number } | null {
  const from = elements.find((e) => e.id === packet.fromNodeId);
  const to   = elements.find((e) => e.id === packet.toNodeId);
  if (!from || !to) return null;

  const fx = from.x + from.width  / 2;
  const fy = from.y + from.height / 2;
  const tx = to.x   + to.width    / 2;
  const ty = to.y   + to.height   / 2;

  const t = packet.progress;
  return {
    x: fx + (tx - fx) * t,
    y: fy + (ty - fy) * t,
  };
}
