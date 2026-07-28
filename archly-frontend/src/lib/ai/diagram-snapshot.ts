/**
 * Builds a compact diagram snapshot for the canvas chat API.
 * Supports Excalidraw (active canvas tab) and Flow.
 */

import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { getComponent } from "@/lib/components-registry";
import { useCanvasStore } from "@/store/canvas.store";
import { useFlowStore } from "@/store/flow.store";
import { useSchemaStore } from "@/store/schema.store";
import { useSimulationStore } from "@/store/simulation.store";
import type { SchemaColumn } from "@/types/schema";

export type CanvasKind = "excalidraw" | "flow" | "schema";

export interface DiagramNodeSnapshot {
  id: string;
  label: string;
  componentId?: string;
  description?: string;
}

export interface DiagramEdgeSnapshot {
  source: string;
  target: string;
}

export interface DiagramChaosSnapshot {
  id: string;
  type: string;
  nodeId: string;
  params?: Record<string, number | undefined>;
  injectedAt?: number;
}

export interface DiagramMetricsSnapshot {
  nodeId: string;
  rps?: number;
  latencyAvg?: number;
  errorRate?: number;
  cpuPercent?: number;
  isBottleneck?: boolean;
}

export interface DiagramSnapshot {
  nodes: DiagramNodeSnapshot[];
  edges: DiagramEdgeSnapshot[];
  selection: string[];
  chaos: DiagramChaosSnapshot[];
  metrics: DiagramMetricsSnapshot[];
}

function labelFromExcalidrawElement(el: {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customData?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}): string {
  if (typeof el.customData?.label === "string" && el.customData.label.trim()) {
    return el.customData.label.trim();
  }
  // Bound text children often hold the visible label
  return "";
}

function buildExcalidrawSnapshot(): Pick<DiagramSnapshot, "nodes" | "edges" | "selection"> {
  const api = getExcalidrawAPI();
  const selectedElementIds = useCanvasStore.getState().selectedElementIds;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = api?.getSceneElements?.() ?? useCanvasStore.getState().elements ?? [];

  // Map text elements by containerId for labels
  const textByContainer = new Map<string, string>();
  for (const el of elements) {
    if (el.isDeleted || el.type !== "text") continue;
    if (el.containerId && typeof el.text === "string") {
      textByContainer.set(el.containerId, el.text.trim());
    }
  }

  const nodes: DiagramNodeSnapshot[] = [];
  for (const el of elements) {
    if (el.isDeleted) continue;
    const componentId: string | undefined =
      el.customData?.componentId ?? el.customData?.component_id;
    // Architecture nodes are rectangles (or similar) with componentId
    if (!componentId && el.type !== "rectangle" && el.type !== "diamond" && el.type !== "ellipse") {
      continue;
    }
    if (!componentId) continue;

    const label =
      labelFromExcalidrawElement(el) ||
      textByContainer.get(el.id) ||
      getComponent(componentId)?.name ||
      componentId;

    const comp = getComponent(componentId);
    nodes.push({
      id: el.id,
      label,
      componentId,
      description: comp?.description,
    });
  }

  // Excalidraw arrows → edges when both ends bind to known nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: DiagramEdgeSnapshot[] = [];
  for (const el of elements) {
    if (el.isDeleted || el.type !== "arrow") continue;
    const startId = el.startBinding?.elementId;
    const endId = el.endBinding?.elementId;
    if (startId && endId && nodeIds.has(startId) && nodeIds.has(endId)) {
      edges.push({ source: startId, target: endId });
    }
  }

  const selection = selectedElementIds.filter((id) => nodeIds.has(id));
  return { nodes, edges, selection };
}

function buildFlowSnapshot(): Pick<DiagramSnapshot, "nodes" | "edges" | "selection"> {
  const { nodes: flowNodes, edges: flowEdges, selectedNodeId } = useFlowStore.getState();

  const nodes: DiagramNodeSnapshot[] = flowNodes.map((n) => {
    const componentId = n.data.componentId;
    const comp = componentId ? getComponent(componentId) : undefined;
    return {
      id: n.id,
      label: n.data.label || comp?.name || n.id,
      componentId,
      description: comp?.description,
    };
  });

  const edges: DiagramEdgeSnapshot[] = flowEdges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  const selection = selectedNodeId ? [selectedNodeId] : [];
  return { nodes, edges, selection };
}

function buildSchemaSnapshot(): Pick<DiagramSnapshot, "nodes" | "edges" | "selection"> {
  const { nodes: schemaNodes, edges: schemaEdges, selectedTableId } = useSchemaStore.getState();

  const nodes: DiagramNodeSnapshot[] = schemaNodes.map((n) => {
    const cols = ((n.data?.columns ?? []) as SchemaColumn[])
      .slice(0, 16)
      .map((c) => {
        const flags = [c.pk && "PK", c.fk && `FK→${c.fk.table}`, c.unique && "UK"]
          .filter(Boolean)
          .join(",");
        return flags ? `${c.name}:${c.type}(${flags})` : `${c.name}:${c.type}`;
      })
      .join(", ");
    return {
      id: n.id,
      label: String(n.data?.tableName ?? n.id),
      componentId: "database-table",
      description: cols || undefined,
    };
  });

  const edges: DiagramEdgeSnapshot[] = schemaEdges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  const selection = selectedTableId ? [selectedTableId] : [];
  return { nodes, edges, selection };
}

function buildChaosAndMetrics(nodeIds: Set<string>): Pick<DiagramSnapshot, "chaos" | "metrics"> {
  const { activeInjections, metrics } = useSimulationStore.getState();

  const chaos: DiagramChaosSnapshot[] = activeInjections.map((inj) => ({
    id: inj.id,
    type: inj.type,
    nodeId: inj.nodeId,
    params: inj.params,
    injectedAt: inj.injectedAt,
  }));

  const metricsOut: DiagramMetricsSnapshot[] = [];
  for (const nodeId of nodeIds) {
    const m = metrics[nodeId];
    if (!m) continue;
    metricsOut.push({
      nodeId,
      rps: m.rps,
      latencyAvg: m.latencyAvg,
      errorRate: m.errorRate,
      cpuPercent: m.cpuPercent,
      isBottleneck: m.isBottleneck,
    });
  }

  return { chaos, metrics: metricsOut };
}

/** Snapshot the active canvas for the chat API. */
export function buildDiagramSnapshot(canvas: CanvasKind): DiagramSnapshot {
  const base =
    canvas === "schema"
      ? buildSchemaSnapshot()
      : canvas === "flow"
        ? buildFlowSnapshot()
        : buildExcalidrawSnapshot();
  const nodeIds = new Set(base.nodes.map((n) => n.id));
  // Schema mode has no chaos/sim metrics
  if (canvas === "schema") {
    return { ...base, chaos: [], metrics: [] };
  }
  const { chaos, metrics } = buildChaosAndMetrics(nodeIds);
  return { ...base, chaos, metrics };
}

/** Human-readable selection hint for the chat UI. */
export function selectionHint(snapshot: DiagramSnapshot): string | null {
  if (snapshot.selection.length === 0) return null;
  const labels = snapshot.selection
    .map((id) => snapshot.nodes.find((n) => n.id === id)?.label ?? id)
    .filter(Boolean);
  if (labels.length === 0) return null;
  return labels.length === 1 ? `Selected: ${labels[0]}` : `Selected: ${labels.join(", ")}`;
}
