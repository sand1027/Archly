/**
 * Architecture lint rules + fix suggestions for Flow diagrams.
 */

import { getComponent } from "@/lib/components-registry";
import { useFlowStore } from "@/store/flow.store";

export type LintSeverity = "error" | "warn" | "info";

export interface LintIssue {
  id: string;
  severity: LintSeverity;
  title: string;
  detail: string;
  /** Node ids involved */
  nodeIds: string[];
  fixLabel?: string;
  /** Apply a structural fix on the Flow store */
  applyFix?: () => void;
}

const EDGE = new Set([
  "load_balancer",
  "api_gateway",
  "ingress",
  "cdn",
  "cloudflare",
  "fastly",
  "anycast_lb",
]);

const COMPUTE = new Set([
  "app_server",
  "worker",
  "serverless",
  "cloud_function",
  "nodejs",
  "python",
  "go_service",
]);

const DB = new Set([
  "sql_db",
  "nosql_db",
  "mysql",
  "dynamodb",
  "cockroachdb",
  "cassandra",
  "scylladb",
  "timescaledb",
]);

const QUEUE = new Set([
  "message_queue",
  "sqs",
  "kafka",
  "pubsub",
  "event_stream",
  "nats",
  "redpanda",
  "redis_pubsub",
]);

const WORKER = new Set(["worker", "serverless", "cloud_function", "sidekiq"]);

const OBS = new Set(["metrics", "logs", "tracing", "alerting", "health_check", "jaeger", "loki"]);

const CACHE = new Set(["cache", "memcached", "dragonfly"]);

const CLIENT = new Set(["client", "mobile", "web_browser"]);

const WAF = new Set(["waf"]);

function compId(n: { data?: { componentId?: string } }): string {
  return n.data?.componentId ?? "";
}

function addComponentNear(
  componentId: string,
  label: string,
  nearIds: string[]
) {
  const flow = useFlowStore.getState();
  const comp = getComponent(componentId);
  if (!comp) return;

  const nodes = flow.nodes;
  let x = 80;
  let y = 80;
  if (nearIds.length) {
    const refs = nodes.filter((n) => nearIds.includes(n.id));
    if (refs.length) {
      const avgX = refs.reduce((s, n) => s + n.position.x, 0) / refs.length;
      const avgY = refs.reduce((s, n) => s + n.position.y, 0) / refs.length;
      x = avgX;
      y = avgY + 160;
    }
  } else if (nodes.length) {
    const maxY = Math.max(...nodes.map((n) => n.position.y));
    x = 80;
    y = maxY + 160;
  }

  const id = flow.addNode(comp.id, label, comp.color, comp.strokeColor, comp.icon, { x, y });

  // Connect from first near node if possible
  if (nearIds[0]) {
    useFlowStore.getState().onConnect({ source: nearIds[0], target: id });
  }
  return id;
}

export function lintArchitecture(
  nodes: { id: string; data?: { componentId?: string; label?: string }; position: { x: number; y: number } }[],
  edges: { source: string; target: string }[]
): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!nodes.length) return issues;

  const ids = nodes.map(compId);
  const byType = (set: Set<string>) => nodes.filter((n) => set.has(compId(n)));

  const clients = byType(CLIENT);
  const edge = byType(EDGE);
  const compute = byType(COMPUTE);
  const dbs = byType(DB);
  const queues = byType(QUEUE);
  const workers = byType(WORKER);
  const obs = byType(OBS);
  const caches = byType(CACHE);
  const wafs = byType(WAF);

  // No load balancer / gateway between client and compute
  if (clients.length && compute.length && !edge.length) {
    issues.push({
      id: "missing-edge",
      severity: "warn",
      title: "No load balancer or API gateway",
      detail: "Clients talk to compute with no LB/CDN/gateway — add edge traffic control.",
      nodeIds: [...clients, ...compute].map((n) => n.id),
      fixLabel: "Add Load Balancer",
      applyFix: () => {
        const id = addComponentNear("load_balancer", "Load Balancer", clients.map((n) => n.id));
        if (!id) return;
        for (const c of compute.slice(0, 3)) {
          useFlowStore.getState().onConnect({ source: id, target: c.id });
        }
      },
    });
  }

  // DB with inbound from client (exposed)
  for (const db of dbs) {
    const inbound = edges.filter((e) => e.target === db.id).map((e) => e.source);
    const fromClient = inbound.filter((sid) => {
      const n = nodes.find((x) => x.id === sid);
      return n && CLIENT.has(compId(n));
    });
    if (fromClient.length) {
      issues.push({
        id: `db-exposed-${db.id}`,
        severity: "error",
        title: "Database exposed to clients",
        detail: `"${db.data?.label ?? "DB"}" is connected directly from a client. Put an API/LB in front.`,
        nodeIds: [db.id, ...fromClient],
        fixLabel: "Insert API Gateway",
        applyFix: () => {
          const gw = addComponentNear("api_gateway", "API Gateway", fromClient);
          if (!gw) return;
          const flow = useFlowStore.getState();
          // Remove direct client→db edges and rewire via gateway
          const keep = flow.edges.filter(
            (e) => !(fromClient.includes(e.source) && e.target === db.id)
          );
          useFlowStore.setState({ edges: keep });
          for (const cid of fromClient) {
            flow.onConnect({ source: cid, target: gw });
          }
          flow.onConnect({ source: gw, target: db.id });
        },
      });
    }
  }

  // Queue without worker
  if (queues.length && !workers.length && !compute.some((n) => WORKER.has(compId(n)))) {
    issues.push({
      id: "queue-no-worker",
      severity: "warn",
      title: "Queue without a worker",
      detail: "You have a message queue but no worker/consumer to process jobs.",
      nodeIds: queues.map((n) => n.id),
      fixLabel: "Add Worker",
      applyFix: () => {
        const id = addComponentNear("worker", "Worker", queues.map((n) => n.id));
        if (!id) return;
        for (const q of queues.slice(0, 2)) {
          useFlowStore.getState().onConnect({ source: q.id, target: id });
        }
      },
    });
  }

  // Missing observability
  if ((compute.length || dbs.length) && !obs.length) {
    issues.push({
      id: "missing-obs",
      severity: "info",
      title: "No observability",
      detail: "Add metrics, logs, or tracing so production issues are visible.",
      nodeIds: [...compute, ...dbs].slice(0, 5).map((n) => n.id),
      fixLabel: "Add Metrics",
      applyFix: () => {
        addComponentNear("metrics", "Metrics", compute.map((n) => n.id));
      },
    });
  }

  // SQL/NoSQL without cache on a multi-tier app
  if (dbs.length && compute.length >= 2 && !caches.length) {
    issues.push({
      id: "missing-cache",
      severity: "info",
      title: "No cache layer",
      detail: "Multi-service apps usually benefit from Redis/Memcached in front of the DB.",
      nodeIds: dbs.map((n) => n.id),
      fixLabel: "Add Cache",
      applyFix: () => {
        const id = addComponentNear("cache", "Cache", dbs.map((n) => n.id));
        if (!id || !compute[0]) return;
        useFlowStore.getState().onConnect({ source: compute[0].id, target: id });
        if (dbs[0]) useFlowStore.getState().onConnect({ source: id, target: dbs[0].id });
      },
    });
  }

  // Public edge without WAF
  if (edge.length && clients.length && !wafs.length) {
    const hasCloudEdge = ids.some(
      (id) => id === "cdn" || id === "cloudflare" || id === "fastly"
    );
    if (hasCloudEdge || edge.length) {
      issues.push({
        id: "missing-waf",
        severity: "info",
        title: "No WAF in front of edge",
        detail: "Public entry points should usually sit behind a Web Application Firewall.",
        nodeIds: edge.map((n) => n.id),
        fixLabel: "Add WAF",
        applyFix: () => {
          const id = addComponentNear("waf", "WAF", clients.map((n) => n.id));
          if (!id || !edge[0]) return;
          useFlowStore.getState().onConnect({ source: id, target: edge[0].id });
        },
      });
    }
  }

  // Orphan nodes (no edges)
  if (nodes.length >= 3) {
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    const orphans = nodes.filter((n) => !connected.has(n.id));
    if (orphans.length) {
      issues.push({
        id: "orphans",
        severity: "warn",
        title: `${orphans.length} disconnected node${orphans.length === 1 ? "" : "s"}`,
        detail: orphans
          .slice(0, 4)
          .map((n) => n.data?.label ?? n.id)
          .join(", ") + (orphans.length > 4 ? "…" : ""),
        nodeIds: orphans.map((n) => n.id),
      });
    }
  }

  // Single DB with many compute writers — suggest read replica note
  if (dbs.length === 1 && compute.length >= 3) {
    const db = dbs[0];
    const writers = edges.filter((e) => e.target === db.id).length;
    if (writers >= 3) {
      issues.push({
        id: "hot-db",
        severity: "warn",
        title: "Single DB fan-in",
        detail: `${writers} services write to one database — consider replicas, CQRS, or sharding.`,
        nodeIds: [db.id],
        fixLabel: "Add Read Replica",
        applyFix: () => {
          addComponentNear(compId(db) || "sql_db", "Read Replica", [db.id]);
        },
      });
    }
  }

  return issues;
}
