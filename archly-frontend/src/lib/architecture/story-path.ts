/**
 * Architecture Story — path finding, hop roles, narration, latency estimates.
 */

import { getComponent } from "@/lib/components-registry";

export type HopRole = "Entry" | "Edge" | "Compute" | "State" | "Async" | "Other";

export type StoryMode = "happy" | "read" | "write" | "fail";

export interface StoryGraphNode {
  id: string;
  data?: { componentId?: string; label?: string };
}

export interface StoryGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface StoryPathResult {
  nodeIds: string[];
  edgeIds: string[];
}

export interface BranchOption {
  edgeId: string;
  targetId: string;
  label: string;
}

const ENTRY_IDS = new Set(["client", "mobile", "web_browser"]);
const EDGE_IDS = new Set([
  "dns",
  "cdn",
  "load_balancer",
  "waf",
  "api_gateway",
  "ingress",
  "fastly",
  "cloudflare",
  "anycast_lb",
  "nginx",
  "haproxy",
  "traefik",
  "kong",
]);
const STATE_IDS = new Set([
  "sql_db",
  "nosql_db",
  "mysql",
  "dynamodb",
  "cache",
  "memcached",
  "object_store",
  "gcs",
  "data_warehouse",
  "vector_db",
  "cockroachdb",
  "cassandra",
  "scylladb",
  "timescaledb",
  "vitess",
  "clickhouse",
  "influxdb",
  "neo4j",
  "pinecone",
  "weaviate",
  "qdrant",
  "milvus",
  "dragonfly",
]);
const ASYNC_IDS = new Set([
  "message_queue",
  "sqs",
  "kafka",
  "pubsub",
  "event_stream",
  "nats",
  "redpanda",
  "redis_pubsub",
  "worker",
  "sidekiq",
  "scheduler",
  "cron_trigger",
  "daily_batch",
]);

/** Classify a hop for story badges. */
export function classifyHop(componentId: string | undefined | null): HopRole {
  if (!componentId) return "Other";
  if (ENTRY_IDS.has(componentId)) return "Entry";
  if (EDGE_IDS.has(componentId)) return "Edge";
  if (STATE_IDS.has(componentId)) return "State";
  if (ASYNC_IDS.has(componentId)) return "Async";
  const cat = getComponent(componentId)?.category;
  if (cat === "clients") return "Entry";
  if (cat === "traffic_edge" || cat === "network") return "Edge";
  if (cat === "storage") return "State";
  if (cat === "messaging") return "Async";
  if (cat === "compute" || cat === "ai_agents") return "Compute";
  return "Other";
}

/** Rough latency contribution (ms) for the latency budget bar. */
export function hopLatencyMs(componentId: string | undefined | null): number {
  const role = classifyHop(componentId);
  switch (role) {
    case "Entry":
      return 5;
    case "Edge":
      return componentId === "cdn" || componentId === "cloudflare" || componentId === "fastly" ? 12 : 8;
    case "Compute":
      return componentId === "serverless" || componentId === "cloud_function" ? 40 : 25;
    case "State":
      return componentId === "cache" || componentId === "memcached" || componentId === "dragonfly" ? 3 : 18;
    case "Async":
      return 15;
    default:
      return 10;
  }
}

export function pickDefaultStartId(nodes: StoryGraphNode[]): string | null {
  const byRole = (role: HopRole) =>
    nodes.find((n) => classifyHop(n.data?.componentId) === role)?.id ?? null;
  return (
    byRole("Entry") ??
    nodes.find((n) => ENTRY_IDS.has(n.data?.componentId ?? ""))?.id ??
    nodes[0]?.id ??
    null
  );
}

export function pickDefaultEndId(nodes: StoryGraphNode[], startId?: string | null): string | null {
  const sinks = nodes.filter((n) => {
    const role = classifyHop(n.data?.componentId);
    return role === "State" && n.id !== startId;
  });
  if (sinks.length) return sinks[sinks.length - 1].id;
  const other = nodes.filter((n) => n.id !== startId);
  return other[other.length - 1]?.id ?? null;
}

/** Shortest path BFS on directed edges. If no endId, prefer longest shortest-path to a State sink, else any reachable. */
export function findShortestPath(
  nodes: StoryGraphNode[],
  edges: StoryGraphEdge[],
  startId: string,
  endId?: string | null
): StoryPathResult | null {
  if (!nodes.some((n) => n.id === startId)) return null;

  const adj = new Map<string, { edgeId: string; target: string }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ edgeId: e.id, target: e.target });
  }

  const goal = endId && nodes.some((n) => n.id === endId) ? endId : null;

  type Frame = { id: string; pathN: string[]; pathE: string[] };
  const q: Frame[] = [{ id: startId, pathN: [startId], pathE: [] }];
  const seen = new Set<string>([startId]);

  let bestSink: StoryPathResult | null = null;

  while (q.length) {
    const cur = q.shift()!;
    if (goal && cur.id === goal) {
      return { nodeIds: cur.pathN, edgeIds: cur.pathE };
    }
    if (!goal && cur.pathN.length > 1) {
      const role = classifyHop(nodes.find((n) => n.id === cur.id)?.data?.componentId);
      if (role === "State") {
        if (!bestSink || cur.pathN.length > bestSink.nodeIds.length) {
          bestSink = { nodeIds: [...cur.pathN], edgeIds: [...cur.pathE] };
        }
      }
    }
    for (const next of adj.get(cur.id) ?? []) {
      if (seen.has(next.target)) continue;
      seen.add(next.target);
      q.push({
        id: next.target,
        pathN: [...cur.pathN, next.target],
        pathE: [...cur.pathE, next.edgeId],
      });
    }
  }

  if (goal) return null;
  if (bestSink) return bestSink;

  // Fallback: any longest BFS path from start
  const q2: Frame[] = [{ id: startId, pathN: [startId], pathE: [] }];
  const seen2 = new Set<string>([startId]);
  let longest: StoryPathResult = { nodeIds: [startId], edgeIds: [] };
  while (q2.length) {
    const cur = q2.shift()!;
    if (cur.pathN.length > longest.nodeIds.length) {
      longest = { nodeIds: cur.pathN, edgeIds: cur.pathE };
    }
    for (const next of adj.get(cur.id) ?? []) {
      if (seen2.has(next.target)) continue;
      seen2.add(next.target);
      q2.push({
        id: next.target,
        pathN: [...cur.pathN, next.target],
        pathE: [...cur.pathE, next.edgeId],
      });
    }
  }
  return longest.nodeIds.length > 1 ? longest : null;
}

/** Outbound choices from a node that are not yet committed as the next path edge. */
export function getBranchOptions(
  nodes: StoryGraphNode[],
  edges: StoryGraphEdge[],
  fromNodeId: string,
  preferredNextEdgeId?: string | null
): BranchOption[] {
  const outs = edges.filter((e) => e.source === fromNodeId);
  if (outs.length < 2) return [];
  return outs.map((e) => {
    const tgt = nodes.find((n) => n.id === e.target);
    const label = String(tgt?.data?.label ?? e.target);
    return { edgeId: e.id, targetId: e.target, label };
  }).filter((o) => !preferredNextEdgeId || o.edgeId !== preferredNextEdgeId || outs.length >= 2);
}

/** When user picks a branch mid-story, rebuild path: prefix + BFS from branch target to end. */
export function rebuildPathAfterBranch(
  nodes: StoryGraphNode[],
  edges: StoryGraphEdge[],
  pathNodeIds: string[],
  hopIndex: number,
  chosenEdgeId: string,
  endId?: string | null
): StoryPathResult | null {
  const edge = edges.find((e) => e.id === chosenEdgeId);
  if (!edge) return null;
  const prefixNodes = pathNodeIds.slice(0, hopIndex + 1);
  if (prefixNodes[prefixNodes.length - 1] !== edge.source) return null;

  const rest = findShortestPath(nodes, edges, edge.target, endId);
  const prefixEdges: string[] = [];
  for (let i = 0; i < prefixNodes.length - 1; i++) {
    const a = prefixNodes[i];
    const b = prefixNodes[i + 1];
    const e = edges.find((x) => x.source === a && x.target === b);
    if (e) prefixEdges.push(e.id);
  }
  prefixEdges.push(edge.id);

  if (!rest) {
    return { nodeIds: [...prefixNodes, edge.target], edgeIds: prefixEdges };
  }
  return {
    nodeIds: [...prefixNodes, ...rest.nodeIds],
    edgeIds: [...prefixEdges, ...rest.edgeIds],
  };
}

export function narrateHop(
  node: StoryGraphNode | undefined,
  prev: StoryGraphNode | undefined,
  next: StoryGraphNode | undefined,
  mode: StoryMode,
  hopIndex: number,
  totalHops: number
): { title: string; body: string } {
  const label = String(node?.data?.label ?? "Node");
  const cid = node?.data?.componentId;
  const role = classifyHop(cid);
  const isLast = hopIndex >= totalHops - 1;
  const isFirst = hopIndex === 0;

  if (mode === "fail") {
    return {
      title: `${label} fails`,
      body: next
        ? `If ${label} is down, the request never reaches ${next.data?.label ?? "downstream"}. Clients see errors or timeouts.`
        : `${label} is the failure point — nothing downstream can complete this request.`,
    };
  }

  if (isFirst) {
    return {
      title: `Request starts at ${label}`,
      body:
        role === "Entry"
          ? "The client issues an HTTP request. Latency budget starts here."
          : `Traffic enters the system at ${label}.`,
    };
  }

  if (isLast) {
    const line =
      role === "State"
        ? "Durable state lives here — reads and writes land in this store."
        : "End of this path — the response (or side-effect) completes.";
    return {
      title: `Arrives at ${label}`,
      body: `${line} Interview line: “Clear request path from edge to durable store.”`,
    };
  }

  const templates: Record<HopRole, string> = {
    Entry: `${label} originates or re-issues the call.`,
    Edge: `${label} terminates TLS, routes, or caches at the edge before compute.`,
    Compute: `${label} runs business logic${prev ? ` after ${prev.data?.label}` : ""}${next ? `, then calls ${next.data?.label}` : ""}.`,
    State: `${label} serves as the source of truth for this hop.`,
    Async: `${label} decouples the sync path — work continues without blocking the client.`,
    Other: `The request passes through ${label}.`,
  };

  if (mode === "read" && role === "State") {
    return {
      title: `Read from ${label}`,
      body: "Read path: prefer cache/replicas when present; this hop is the data source for the response.",
    };
  }
  if (mode === "write" && (role === "Async" || role === "State")) {
    return {
      title: `Write via ${label}`,
      body:
        role === "Async"
          ? "Write path often fans into a queue so the API returns quickly while workers persist."
          : `Write path persists at ${label}.`,
    };
  }

  return {
    title: label,
    body: templates[role],
  };
}

export function interviewOneLiner(pathNodeIds: string[], nodes: StoryGraphNode[]): string {
  const labels = pathNodeIds
    .map((id) => nodes.find((n) => n.id === id)?.data?.label)
    .filter(Boolean)
    .slice(0, 6);
  if (labels.length < 2) return "Stateless edge and compute in front of durable state.";
  return `${labels.join(" → ")} — clear hop-by-hop request path.`;
}

export const HOP_ROLE_COLORS: Record<HopRole, string> = {
  Entry: "#6b7280",
  Edge: "#2563eb",
  Compute: "#16a34a",
  State: "#7c3aed",
  Async: "#d97706",
  Other: "#64748b",
};
