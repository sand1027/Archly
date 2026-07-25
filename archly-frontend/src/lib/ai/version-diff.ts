interface SnapshotCounts {
  nodes: number;
  edges: number;
}

function parseSnapshot(snapshot: unknown): unknown {
  if (typeof snapshot !== "string") return snapshot;
  try {
    return JSON.parse(snapshot);
  } catch {
    return null;
  }
}

function countSnapshot(snapshot: unknown): SnapshotCounts {
  const parsed = parseSnapshot(snapshot);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const flow = parsed as { nodes?: unknown[]; edges?: unknown[] };
    if (Array.isArray(flow.nodes) || Array.isArray(flow.edges)) {
      return {
        nodes: Array.isArray(flow.nodes) ? flow.nodes.length : 0,
        edges: Array.isArray(flow.edges) ? flow.edges.length : 0,
      };
    }
  }

  if (Array.isArray(parsed)) {
    const elements = parsed.filter(
      (element) =>
        element &&
        typeof element === "object" &&
        !(element as { isDeleted?: boolean }).isDeleted
    ) as Array<{
      type?: string;
      customData?: { componentId?: string; component_id?: string };
    }>;
    return {
      nodes: elements.filter(
        (element) =>
          Boolean(element.customData?.componentId ?? element.customData?.component_id) &&
          element.type !== "arrow"
      ).length,
      edges: elements.filter((element) => element.type === "arrow").length,
    };
  }

  return { nodes: 0, edges: 0 };
}

function change(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Summarize structural changes from a previous snapshot to the current one. */
export function summarizeVersionDiff(current: unknown, previous: unknown): string {
  const currentCounts = countSnapshot(current);
  const previousCounts = countSnapshot(previous);
  const nodeDelta = currentCounts.nodes - previousCounts.nodes;
  const edgeDelta = currentCounts.edges - previousCounts.edges;

  if (nodeDelta === 0 && edgeDelta === 0) {
    return `No structural change (${currentCounts.nodes} nodes, ${currentCounts.edges} edges).`;
  }

  return `Current has ${currentCounts.nodes} nodes (${change(nodeDelta)}) and ${currentCounts.edges} edges (${change(edgeDelta)}) vs this version.`;
}
