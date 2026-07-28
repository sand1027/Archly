/**
 * Applies structured chaos actions returned by the canvas chat API.
 */

import { getChaosType } from "@/lib/simulation/chaos";
import { getComponent } from "@/lib/components-registry";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { useSchemaStore } from "@/store/schema.store";
import type { ChaosType } from "@/types";
import type { CanvasKind, DiagramSnapshot } from "@/lib/ai/diagram-snapshot";
import type { SchemaColumn } from "@/types/schema";

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
  | { type: "clear_chaos" }
  | { type: "add_node"; componentId: string; label?: string; x?: number; y?: number }
  | { type: "remove_node"; nodeId?: string; nodeLabel?: string }
  | {
      type: "connect" | "disconnect";
      source?: string;
      target?: string;
      sourceLabel?: string;
      targetLabel?: string;
    }
  | { type: "relabel"; nodeId?: string; nodeLabel?: string; label: string };

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

function flowSnapshot(snapshot: DiagramSnapshot): DiagramSnapshot {
  const { nodes, edges, selectedNodeId } = useFlowStore.getState();
  return {
    ...snapshot,
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.data?.label ?? node.id,
      componentId: node.data?.componentId,
    })),
    edges: edges.map((edge) => ({ source: edge.source, target: edge.target })),
    selection: selectedNodeId ? [selectedNodeId] : [],
  };
}

function schemaSnapshot(snapshot: DiagramSnapshot): DiagramSnapshot {
  const { nodes, edges, selectedTableId } = useSchemaStore.getState();
  return {
    ...snapshot,
    nodes: nodes.map((node) => ({
      id: node.id,
      label: String(node.data?.tableName ?? node.id),
      componentId: "database-table",
    })),
    edges: edges.map((edge) => ({ source: edge.source, target: edge.target })),
    selection: selectedTableId ? [selectedTableId] : [],
  };
}

function defaultSchemaColumns(): SchemaColumn[] {
  return [
    { name: "id", type: "uuid", pk: true },
    { name: "created_at", type: "timestamptz", nullable: false },
  ];
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export function applyChatActions(
  actions: ChatAction[],
  snapshot: DiagramSnapshot,
  canvas: CanvasKind = "flow"
): ActionResult[] {
  const sim = useSimulationStore.getState();
  const results: ActionResult[] = [];

  for (const action of actions) {
    if (
      action.type === "add_node" ||
      action.type === "remove_node" ||
      action.type === "connect" ||
      action.type === "disconnect" ||
      action.type === "relabel"
    ) {
      if (canvas === "schema") {
        const schema = useSchemaStore.getState();
        const liveSnapshot = schemaSnapshot(snapshot);

        if (action.type === "add_node") {
          const name =
            action.label?.trim() ||
            action.componentId?.replace(/[^a-zA-Z0-9_]+/g, "_") ||
            "new_table";
          const n = schema.nodes.length;
          const id = schema.addTable(name, defaultSchemaColumns(), {
            x: action.x ?? 80 + (n % 4) * 280,
            y: action.y ?? 80 + Math.floor(n / 4) * 220,
          });
          results.push({ ok: true, message: `Added table ${name} (${id})` });
          continue;
        }

        if (action.type === "remove_node") {
          const nodeId = resolveNodeId(liveSnapshot, action.nodeId, action.nodeLabel);
          if (!nodeId) {
            results.push({ ok: false, message: "Could not find table to remove" });
            continue;
          }
          const label = nodeLabel(liveSnapshot, nodeId);
          schema.removeTable(nodeId);
          results.push({ ok: true, message: `Removed table ${label}` });
          continue;
        }

        if (action.type === "relabel") {
          const nodeId = resolveNodeId(liveSnapshot, action.nodeId, action.nodeLabel);
          const label = action.label?.trim();
          if (!nodeId || !label) {
            results.push({ ok: false, message: "Could not find table or name is empty" });
            continue;
          }
          schema.updateTable(nodeId, { tableName: label });
          results.push({ ok: true, message: `Renamed table to ${label}` });
          continue;
        }

        const source = resolveNodeId(liveSnapshot, action.source, action.sourceLabel);
        const target = resolveNodeId(liveSnapshot, action.target, action.targetLabel);
        if (!source || !target) {
          results.push({ ok: false, message: "Could not resolve both relationship endpoints" });
          continue;
        }

        if (action.type === "connect") {
          const exists = schema.edges.some(
            (edge) => edge.source === source && edge.target === target
          );
          if (exists) {
            results.push({ ok: false, message: "Relationship already exists" });
            continue;
          }
          schema.onConnect({ source, target });
          results.push({
            ok: true,
            message: `Linked ${nodeLabel(liveSnapshot, source)} → ${nodeLabel(liveSnapshot, target)}`,
          });
          continue;
        }

        // disconnect
        const before = schema.edges.length;
        useSchemaStore.setState((s) => ({
          edges: s.edges.filter(
            (e) => !(e.source === source && e.target === target)
          ),
        }));
        const after = useSchemaStore.getState().edges.length;
        results.push({
          ok: before !== after,
          message:
            before !== after
              ? `Unlinked ${nodeLabel(liveSnapshot, source)} → ${nodeLabel(liveSnapshot, target)}`
              : "Relationship not found",
        });
        continue;
      }

      if (canvas !== "flow") {
        results.push({ ok: false, message: "Diagram edits are currently available on Flow or Schema" });
        continue;
      }

      const flow = useFlowStore.getState();
      const liveSnapshot = flowSnapshot(snapshot);

      if (action.type === "add_node") {
        const component = getComponent(action.componentId);
        if (!component) {
          results.push({ ok: false, message: `Unknown component: ${action.componentId}` });
          continue;
        }
        const rightmostX =
          flow.nodes.length > 0
            ? Math.max(...flow.nodes.map((node) => Number(node.position?.x) || 0)) + 220
            : 80;
        const id = flow.addNode(
          component.id,
          action.label?.trim() || component.name,
          component.color,
          component.strokeColor,
          component.icon,
          { x: action.x ?? rightmostX, y: action.y ?? 120 }
        );
        results.push({ ok: true, message: `Added ${action.label?.trim() || component.name} (${id})` });
        continue;
      }

      if (action.type === "remove_node") {
        const nodeId = resolveNodeId(liveSnapshot, action.nodeId, action.nodeLabel);
        if (!nodeId) {
          results.push({ ok: false, message: "Could not find node to remove" });
          continue;
        }
        const label = nodeLabel(liveSnapshot, nodeId);
        flow.removeNode(nodeId);
        results.push({ ok: true, message: `Removed ${label}` });
        continue;
      }

      if (action.type === "relabel") {
        const nodeId = resolveNodeId(liveSnapshot, action.nodeId, action.nodeLabel);
        const label = action.label?.trim();
        if (!nodeId || !label) {
          results.push({ ok: false, message: "Could not find node or label is empty" });
          continue;
        }
        flow.updateNodeLabel(nodeId, label);
        results.push({ ok: true, message: `Relabeled node to ${label}` });
        continue;
      }

      const source = resolveNodeId(liveSnapshot, action.source, action.sourceLabel);
      const target = resolveNodeId(liveSnapshot, action.target, action.targetLabel);
      if (!source || !target) {
        results.push({ ok: false, message: "Could not resolve both connection endpoints" });
        continue;
      }

      if (action.type === "connect") {
        const exists = flow.edges.some(
          (edge) => edge.source === source && edge.target === target
        );
        if (exists) {
          results.push({ ok: false, message: "Connection already exists" });
          continue;
        }
        flow.onConnect({ source, target });
        results.push({
          ok: true,
          message: `Connected ${nodeLabel(liveSnapshot, source)} → ${nodeLabel(liveSnapshot, target)}`,
        });
        continue;
      }

      const matchingEdges = flow.edges.filter(
        (edge) => edge.source === source && edge.target === target
      );
      if (matchingEdges.length === 0) {
        results.push({ ok: false, message: "Connection not found" });
        continue;
      }
      const edgeIds = new Set(matchingEdges.map((edge) => edge.id));
      useFlowStore.setState((state) => ({
        edges: state.edges.filter((edge) => !edgeIds.has(edge.id)),
      }));
      results.push({
        ok: true,
        message: `Disconnected ${nodeLabel(liveSnapshot, source)} → ${nodeLabel(liveSnapshot, target)}`,
      });
      continue;
    }

    if (action.type === "clear_chaos") {
      if (canvas === "schema") {
        results.push({ ok: false, message: "Chaos is architecture-only — not available in Schema" });
        continue;
      }
      const n = sim.activeInjections.length;
      sim.clearAllChaos();
      results.push({
        ok: true,
        message: n > 0 ? `Cleared ${n} chaos injection${n === 1 ? "" : "s"}` : "No chaos to clear",
      });
      continue;
    }

    if (action.type === "remove_chaos") {
      if (canvas === "schema") {
        results.push({ ok: false, message: "Chaos is architecture-only — not available in Schema" });
        continue;
      }
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
      if (canvas === "schema") {
        results.push({ ok: false, message: "Chaos is architecture-only — not available in Schema" });
        continue;
      }
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
