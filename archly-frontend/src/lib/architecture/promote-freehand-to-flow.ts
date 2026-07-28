/**
 * Promote Excalidraw freehand components → Flow nodes.
 */

import { getComponent } from "@/lib/components-registry";
import type { FlowEdge, FlowNode } from "@/store/flow.store";

interface ExcalidrawLikeElement {
  id: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  customData?: {
    componentId?: string;
    label?: string;
  };
}

/**
 * Build Flow nodes from Excalidraw elements that carry componentId.
 * Skips ids already present on the Flow canvas (by element id).
 */
export function promoteFreehandToFlow(
  elements: ExcalidrawLikeElement[],
  existingFlowNodes: FlowNode[]
): { nodes: FlowNode[]; edges: FlowEdge[]; promoted: number; skipped: number } {
  const existingIds = new Set(existingFlowNodes.map((n) => n.id));
  const existingCompAt = new Set(
    existingFlowNodes.map((n) => `${n.data?.componentId}@${Math.round(n.position?.x ?? 0)}`)
  );

  const candidates = elements.filter(
    (el) => el.customData?.componentId && el.type !== "arrow" && el.type !== "line"
  );

  const nodes: FlowNode[] = [...existingFlowNodes];
  let promoted = 0;
  let skipped = 0;
  let col = 0;
  let row = 0;

  for (const el of candidates) {
    const cid = el.customData!.componentId!;
    const flowId = `promoted-${el.id}`;
    if (existingIds.has(flowId) || existingIds.has(el.id)) {
      skipped++;
      continue;
    }
    const def = getComponent(cid);
    const x = typeof el.x === "number" ? el.x : 80 + col * 200;
    const y = typeof el.y === "number" ? el.y : 120 + row * 140;
    const key = `${cid}@${Math.round(x)}`;
    if (existingCompAt.has(key)) {
      skipped++;
      continue;
    }
    nodes.push({
      id: flowId,
      type: "flowNode",
      position: { x, y },
      data: {
        componentId: cid,
        label: el.customData?.label ?? def?.name ?? cid,
        color: def?.color ?? "#f3f4f6",
        strokeColor: def?.strokeColor ?? "#6b7280",
        iconPath: def?.icon ?? "",
      },
    });
    existingIds.add(flowId);
    existingCompAt.add(key);
    promoted++;
    col++;
    if (col > 4) {
      col = 0;
      row++;
    }
  }

  // Preserve existing edges; promotion does not invent connections
  return { nodes, edges: [], promoted, skipped };
}

/** Merge promoted nodes into current graph (keep edges). */
export function mergePromotedGraph(
  currentNodes: FlowNode[],
  currentEdges: FlowEdge[],
  elements: ExcalidrawLikeElement[]
): { nodes: FlowNode[]; edges: FlowEdge[]; promoted: number; skipped: number } {
  const result = promoteFreehandToFlow(elements, currentNodes);
  return {
    nodes: result.nodes,
    edges: currentEdges,
    promoted: result.promoted,
    skipped: result.skipped,
  };
}
