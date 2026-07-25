/**
 * Applies structured chaos actions returned by the canvas chat API.
 */

import { getChaosType } from "@/lib/simulation/chaos";
import { useSimulationStore } from "@/store/simulation.store";
import type { ChaosType } from "@/types";
import type { DiagramSnapshot } from "@/lib/ai/diagram-snapshot";

export type ChatAction =
  | {
      type: "inject_chaos";
      nodeId?: string;
      nodeLabel?: string;
      chaosType: ChaosType | string;
      params?: {
        latencyMs?: number;
        surgeMultiplier?: number;
        throttleKbps?: number;
        canaryPercent?: number;
      };
    }
  | { type: "remove_chaos"; injectionId?: string; nodeId?: string; nodeLabel?: string }
  | { type: "clear_chaos" };

const CHAOS_TYPES = new Set<string>([
  "crash",
  "slow",
  "surge",
  "partition",
  "throttle",
  "canary",
  "zero",
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Resolve a node id from id or fuzzy label match against the snapshot. */
export function resolveNodeId(
  snapshot: DiagramSnapshot,
  nodeId?: string,
  nodeLabel?: string
): string | null {
  if (nodeId && snapshot.nodes.some((n) => n.id === nodeId)) {
    return nodeId;
  }
  // Model sometimes puts label in nodeId
  if (nodeId) {
    const byLabel = snapshot.nodes.find(
      (n) => normalize(n.label) === normalize(nodeId) || normalize(n.componentId ?? "") === normalize(nodeId)
    );
    if (byLabel) return byLabel.id;
  }
  if (nodeLabel) {
    const exact = snapshot.nodes.find((n) => normalize(n.label) === normalize(nodeLabel));
    if (exact) return exact.id;
    const partial = snapshot.nodes.find(
      (n) =>
        normalize(n.label).includes(normalize(nodeLabel)) ||
        normalize(nodeLabel).includes(normalize(n.label))
    );
    if (partial) return partial.id;
  }
  // Fall back to selection when a single node is selected
  if (snapshot.selection.length === 1) {
    return snapshot.selection[0];
  }
  return null;
}

function nodeLabel(snapshot: DiagramSnapshot, nodeId: string): string {
  return snapshot.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export function applyChatActions(
  actions: ChatAction[],
  snapshot: DiagramSnapshot
): ActionResult[] {
  const sim = useSimulationStore.getState();
  const results: ActionResult[] = [];

  for (const action of actions) {
    if (action.type === "clear_chaos") {
      const n = sim.activeInjections.length;
      sim.clearAllChaos();
      results.push({
        ok: true,
        message: n > 0 ? `Cleared ${n} chaos injection${n === 1 ? "" : "s"}` : "No chaos to clear",
      });
      continue;
    }

    if (action.type === "remove_chaos") {
      if (action.injectionId) {
        const exists = sim.activeInjections.some((i) => i.id === action.injectionId);
        if (exists) {
          sim.removeChaos(action.injectionId);
          results.push({ ok: true, message: "Removed chaos injection" });
        } else {
          results.push({ ok: false, message: "Chaos injection not found" });
        }
        continue;
      }
      const nid = resolveNodeId(snapshot, action.nodeId, action.nodeLabel);
      if (!nid) {
        results.push({ ok: false, message: "Could not find node to remove chaos from" });
        continue;
      }
      const onNode = sim.activeInjections.filter((i) => i.nodeId === nid);
      if (onNode.length === 0) {
        results.push({
          ok: false,
          message: `No chaos on ${nodeLabel(snapshot, nid)}`,
        });
        continue;
      }
      for (const inj of onNode) sim.removeChaos(inj.id);
      results.push({
        ok: true,
        message: `Removed chaos from ${nodeLabel(snapshot, nid)}`,
      });
      continue;
    }

    if (action.type === "inject_chaos") {
      const chaosType = String(action.chaosType ?? "");
      if (!CHAOS_TYPES.has(chaosType)) {
        results.push({ ok: false, message: `Unknown chaos type: ${chaosType}` });
        continue;
      }
      const nid = resolveNodeId(snapshot, action.nodeId, action.nodeLabel);
      if (!nid) {
        results.push({
          ok: false,
          message: `Could not find node "${action.nodeId || action.nodeLabel || "?"}"`,
        });
        continue;
      }
      const def = getChaosType(chaosType as ChaosType);
      const params = {
        ...def.defaultParams,
        ...(action.params ?? {}),
      };
      if (!sim.isRunning) {
        sim.start();
      }
      sim.injectChaos({
        id: `chaos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: chaosType as ChaosType,
        nodeId: nid,
        params,
        injectedAt: Date.now(),
      });
      results.push({
        ok: true,
        message: `Injected ${def.label} on ${nodeLabel(snapshot, nid)}`,
      });
      continue;
    }

    results.push({ ok: false, message: "Unknown action" });
  }

  return results;
}
