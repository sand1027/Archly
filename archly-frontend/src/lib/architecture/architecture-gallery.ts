/**
 * Curated architecture gallery — fork into Flow.
 */

import { getComponent } from "@/lib/components-registry";
import type { FlowEdge, FlowNode } from "@/store/flow.store";

export interface GalleryArch {
  id: string;
  title: string;
  blurb: string;
  tags: string[];
  /** component ids in path order for a simple chain, or custom builder */
  build: () => { nodes: FlowNode[]; edges: FlowEdge[] };
}

function chain(
  ids: string[],
  startX = 80,
  y = 180,
  gap = 200
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  ids.forEach((cid, i) => {
    const def = getComponent(cid);
    const id = `gal-${cid}-${i}`;
    nodes.push({
      id,
      type: "flowNode",
      position: { x: startX + i * gap, y },
      data: {
        componentId: cid,
        label: def?.name ?? cid,
        color: def?.color ?? "#f3f4f6",
        strokeColor: def?.strokeColor ?? "#6b7280",
        iconPath: def?.icon ?? "",
      },
    });
    if (i > 0) {
      edges.push({
        id: `gal-e-${i}`,
        source: nodes[i - 1].id,
        target: id,
        type: "flowEdge",
        data: {},
      });
    }
  });
  return { nodes, edges };
}

function branchedChat(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const base = chain(["client", "api_gateway", "app_server", "sql_db"], 60, 120, 190);
  const def = getComponent("message_queue");
  const worker = getComponent("worker");
  const qId = "gal-queue";
  const wId = "gal-worker";
  base.nodes.push(
    {
      id: qId,
      type: "flowNode",
      position: { x: 440, y: 320 },
      data: {
        componentId: "message_queue",
        label: def?.name ?? "Queue",
        color: def?.color ?? "#fef3c7",
        strokeColor: def?.strokeColor ?? "#d97706",
        iconPath: def?.icon ?? "",
      },
    },
    {
      id: wId,
      type: "flowNode",
      position: { x: 640, y: 320 },
      data: {
        componentId: "worker",
        label: worker?.name ?? "Worker",
        color: worker?.color ?? "#dcfce7",
        strokeColor: worker?.strokeColor ?? "#16a34a",
        iconPath: worker?.icon ?? "",
      },
    }
  );
  const app = base.nodes.find((n) => n.data.componentId === "app_server")!;
  base.edges.push(
    { id: "gal-e-q", source: app.id, target: qId, type: "flowEdge", data: { decisionWhy: "Fan notifications off the sync path" } },
    { id: "gal-e-w", source: qId, target: wId, type: "flowEdge", data: {} }
  );
  return base;
}

export const ARCHITECTURE_GALLERY: GalleryArch[] = [
  {
    id: "url-shortener",
    title: "URL shortener",
    blurb: "Classic client → CDN → API → cache → DB read path.",
    tags: ["beginner", "cache"],
    build: () =>
      chain(["client", "cdn", "api_gateway", "app_server", "cache", "sql_db"]),
  },
  {
    id: "chat",
    title: "Chat / messaging",
    blurb: "Gateway + app + DB with async queue for delivery.",
    tags: ["async", "intermediate"],
    build: branchedChat,
  },
  {
    id: "payments",
    title: "Payments",
    blurb: "WAF, gateway, auth, app, queue, worker, DB.",
    tags: ["security", "async"],
    build: () =>
      chain([
        "client",
        "waf",
        "api_gateway",
        "auth_service",
        "app_server",
        "message_queue",
        "worker",
        "sql_db",
      ]),
  },
  {
    id: "feed",
    title: "Social feed",
    blurb: "LB → app → cache + DB; Kafka for fan-out.",
    tags: ["scale"],
    build: () => {
      const g = chain(["client", "load_balancer", "app_server", "cache"], 40, 100, 180);
      const db = getComponent("sql_db");
      const kafka = getComponent("kafka");
      const dbId = "gal-db";
      const kId = "gal-kafka";
      g.nodes.push(
        {
          id: dbId,
          type: "flowNode",
          position: { x: 580, y: 280 },
          data: {
            componentId: "sql_db",
            label: db?.name ?? "SQL",
            color: db?.color ?? "#f3e8ff",
            strokeColor: db?.strokeColor ?? "#7c3aed",
            iconPath: db?.icon ?? "",
          },
        },
        {
          id: kId,
          type: "flowNode",
          position: { x: 380, y: 280 },
          data: {
            componentId: "kafka",
            label: kafka?.name ?? "Kafka",
            color: kafka?.color ?? "#fef3c7",
            strokeColor: kafka?.strokeColor ?? "#d97706",
            iconPath: kafka?.icon ?? "",
          },
        }
      );
      const app = g.nodes.find((n) => n.data.componentId === "app_server")!;
      g.edges.push(
        { id: "gal-db-e", source: app.id, target: dbId, type: "flowEdge", data: { decisionWhy: "Source of truth for posts" } },
        { id: "gal-k-e", source: app.id, target: kId, type: "flowEdge", data: { decisionWhy: "Fan-out feed updates" } }
      );
      return g;
    },
  },
  {
    id: "search",
    title: "Search",
    blurb: "API → search service → OpenSearch + SQL.",
    tags: ["search"],
    build: () =>
      chain(["client", "api_gateway", "search", "opensearch", "sql_db"]),
  },
  {
    id: "ai-rag",
    title: "AI RAG",
    blurb: "Gateway → app → embedding → vector DB + LLM gateway.",
    tags: ["ai"],
    build: () =>
      chain(["client", "api_gateway", "app_server", "embedding", "vector_db", "llm_gateway"]),
  },
];

export function downloadArchitectureJson(
  title: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
) {
  const blob = new Blob(
    [JSON.stringify({ title, nodes, edges, exportedAt: new Date().toISOString() }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "-").toLowerCase() || "architecture"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
