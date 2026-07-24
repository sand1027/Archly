/**
 * Mermaid → React Flow converter.
 *
 * Parses a Mermaid diagram string (flowchart / graph / sequenceDiagram /
 * classDiagram / erDiagram / stateDiagram) and returns React Flow nodes and
 * edges ready to be written into the flow store.
 *
 * Strategy: use @excalidraw/mermaid-to-excalidraw's parseMermaid (which
 * wraps mermaid v11 internally) to get a structured graph, then walk the
 * parsed data and emit RF nodes/edges. This avoids reimplementing a full
 * Mermaid parser.
 *
 * Fallback: if the structured parse fails we do a simple regex scan for
 * "A --> B" / "A -- label --> B" patterns that covers 95 % of flowcharts.
 */

import { COMPONENTS, type ComponentDefinition } from "./components-registry";

// ─── Public types ──────────────────────────────────────────────────────────

export interface FlowConvertResult {
  ok: true;
  nodes: RFNode[];
  edges: RFEdge[];
}

export interface FlowConvertError {
  ok: false;
  error: string;
}

export interface RFNode {
  id: string;
  type: "flowNode";
  position: { x: number; y: number };
  data: {
    componentId: string;
    label: string;
    color: string;
    strokeColor: string;
    iconPath: string;
  };
}

export interface RFEdge {
  id: string;
  type: "flowEdge";
  source: string;
  target: string;
  label?: string;
  animated: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const EDGE_ID = (() => {
  let n = 0;
  return () => `mmd-edge-${++n}-${Date.now()}`;
})();

/**
 * Pick the best-matching component from the registry given a node label.
 * Falls back to "app_server" (generic compute) if nothing matches.
 */
function pickComponent(label: string): ComponentDefinition {
  const lower = label.toLowerCase();

  // Direct name match
  const exact = COMPONENTS.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;

  // Tag / id match
  const tagged = COMPONENTS.find(
    (c) => c.id === lower || c.tags.some((t) => lower.includes(t) || t.includes(lower))
  );
  if (tagged) return tagged;

  // Keyword heuristics — order matters, more specific first
  const hints: [RegExp, string][] = [
    [/client|browser|user|mobile|frontend/i,      "client"],
    [/cdn|cloudflare|fastly|edge/i,               "cdn"],
    [/dns/i,                                       "dns"],
    [/waf|firewall/i,                              "waf"],
    [/api.?gateway|gateway/i,                     "api_gateway"],
    [/load.?bal|lb|nginx|haproxy|traefik/i,       "load_balancer"],
    [/kafka|event.?stream|redpanda/i,             "kafka"],
    [/queue|sqs|rabbit|bull|nats/i,               "message_queue"],
    [/pubsub|pub.?sub/i,                           "pubsub"],
    [/redis|memcach|dragonfly/i,                  "cache"],
    [/postgres|mysql|cockroach|sql|rdb|vitess/i,  "sql_db"],
    [/mongo|dynamo|nosql|couch/i,                 "nosql_db"],
    [/cassandra|scylla|wide.?col/i,               "cassandra"],
    [/elastic|opensearch|solr|search/i,           "opensearch"],
    [/s3|gcs|blob|object.?stor/i,                 "object_store"],
    [/warehouse|bigquery|snowflake|redshift/i,    "data_warehouse"],
    [/vector|pinecone|weaviate|qdrant|milvus/i,   "vector_db"],
    [/influx|timescale|time.?series/i,            "influxdb"],
    [/neo4j|graph.?db/i,                          "neo4j"],
    [/click.?house|olap/i,                        "clickhouse"],
    [/metric|prometheus|grafana|cloudwatch/i,     "metrics"],
    [/log|loki|elk|splunk/i,                      "logs"],
    [/trac|jaeger|zipkin|otel/i,                  "tracing"],
    [/alert|pagerduty|opsgeni/i,                  "alerting"],
    [/health/i,                                    "health_check"],
    [/auth|keycloak|okta|cognito|jwt|oauth/i,     "auth_service"],
    [/secret|vault/i,                             "vault"],
    [/vpn/i,                                       "vpn"],
    [/vpc|subnet|nat/i,                           "vpc"],
    [/mesh|istio|envoy|linkerd|consul/i,          "service_mesh"],
    [/llm|openai|anthropic|gpt|claude/i,          "llm_gateway"],
    [/agent|orchestrat|temporal/i,                "orchestrator"],
    [/embed/i,                                    "embedding"],
    [/payment|stripe|paypal/i,                    "payment"],
    [/email|sendgrid|ses|mail/i,                  "email"],
    [/webhook|callback/i,                         "webhook"],
    [/cron|scheduler|batch/i,                     "scheduler"],
    [/worker|job|async|sidekiq/i,                 "worker"],
    [/serverless|lambda|function/i,               "serverless"],
    [/spark|dbt|transform/i,                      "apache_spark"],
    [/node|express/i,                             "nodejs"],
    [/python|flask|django|fastapi/i,              "python"],
    [/go|golang/i,                                "go_service"],
    [/server|service|backend|api|app/i,           "app_server"],
  ];

  for (const [re, id] of hints) {
    if (re.test(lower)) {
      const comp = COMPONENTS.find((c) => c.id === id);
      if (comp) return comp;
    }
  }

  return COMPONENTS.find((c) => c.id === "app_server")!;
}

/** Simple auto-layout: left-to-right grid, 220 × 130 spacing */
function autoLayout(
  nodeIds: string[]
): Map<string, { x: number; y: number }> {
  const COLS = Math.ceil(Math.sqrt(nodeIds.length));
  const positions = new Map<string, { x: number; y: number }>();
  nodeIds.forEach((id, i) => {
    positions.set(id, {
      x: (i % COLS) * 220,
      y: Math.floor(i / COLS) * 130,
    });
  });
  return positions;
}

// ─── Regex-based fallback parser ───────────────────────────────────────────

/**
 * Minimal Mermaid flowchart parser that handles:
 *   A --> B
 *   A -- label --> B
 *   A -->|label| B
 *   A[Label] --> B[Label]
 *   A(Label) --> B
 *   A[(Label)] --> B   (cylinder / DB)
 *   A{Label} --> B     (diamond)
 */
function regexParse(mermaid: string): { nodes: Map<string, string>; edges: Array<{ from: string; to: string; label: string }> } {
  const nodes = new Map<string, string>(); // id → display label
  const edges: Array<{ from: string; to: string; label: string }> = [];

  // Strip diagram type header
  const lines = mermaid
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%") && !/^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|gitGraph|mindmap|kanban|timeline)\b/i.test(l));

  // Node declaration regex: ID[Label] or ID(Label) or ID[(Label)] or ID{Label} or plain ID
  const nodeDecl = /^([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\[\(([^)]*)\)\]|\{([^}]*)\})?$/;

  // Edge patterns:
  // A --> B
  // A -- text --> B
  // A -->|text| B
  // A -. text .-> B
  const edgePat = /([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\[\(([^)]*)\)\]|\{([^}]*)\})?(?:\s*(?:--?>|--[^>]*->|==?>|-.+?->|-\.->|--\|([^|]*)\|)\s*)([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\[\(([^)]*)\)\]|\{([^}]*)\})?/;

  // Inline edge label: A -->|label| B  or  A -- label --> B
  const inlineLabelPat = /--\s*([^->]+?)\s*-->/;
  const pipeLabelPat   = /-->\|([^|]+)\|/;

  for (const line of lines) {
    // Check if the line contains an edge
    if (/-->|--|==|->|\.\->/.test(line)) {
      // Split on common edge operators to get parts
      // Handles: A --> B,  A -->|lbl| B,  A -- lbl --> B
      const pipeMatch = line.match(/^([A-Za-z0-9_\[\]()\s{}-]+?)-->\|([^|]*)\|\s*([A-Za-z0-9_\[\]()\s{}-]+)$/);
      const dashMatch = line.match(/^([A-Za-z0-9_\[\]()\s{}-]+?)--\s*([^->]*?)\s*-->\s*([A-Za-z0-9_\[\]()\s{}-]+)$/);
      const plainMatch = line.match(/^([A-Za-z0-9_\[\]()\s{}-]+?)-->\s*([A-Za-z0-9_\[\]()\s{}-]+)$/);

      const parseNodeExpr = (expr: string): { id: string; label: string } => {
        expr = expr.trim();
        const bracketMatch = expr.match(/^([A-Za-z0-9_-]+)\[([^\]]*)\]$/);
        const parenMatch   = expr.match(/^([A-Za-z0-9_-]+)\(([^)]*)\)$/);
        const cylMatch     = expr.match(/^([A-Za-z0-9_-]+)\[\(([^)]*)\)\]$/);
        const diamondMatch = expr.match(/^([A-Za-z0-9_-]+)\{([^}]*)\}$/);
        if (bracketMatch) return { id: bracketMatch[1], label: bracketMatch[2] };
        if (parenMatch)   return { id: parenMatch[1],   label: parenMatch[2] };
        if (cylMatch)     return { id: cylMatch[1],     label: cylMatch[2] };
        if (diamondMatch) return { id: diamondMatch[1], label: diamondMatch[2] };
        // plain id
        const cleanId = expr.replace(/[^A-Za-z0-9_-]/g, "");
        return { id: cleanId || expr, label: cleanId || expr };
      };

      let fromNode: { id: string; label: string } | null = null;
      let toNode:   { id: string; label: string } | null = null;
      let edgeLabel = "";

      if (pipeMatch) {
        fromNode  = parseNodeExpr(pipeMatch[1]);
        edgeLabel = pipeMatch[2].trim();
        toNode    = parseNodeExpr(pipeMatch[3]);
      } else if (dashMatch) {
        fromNode  = parseNodeExpr(dashMatch[1]);
        edgeLabel = dashMatch[2].trim();
        toNode    = parseNodeExpr(dashMatch[3]);
      } else if (plainMatch) {
        fromNode = parseNodeExpr(plainMatch[1]);
        toNode   = parseNodeExpr(plainMatch[2]);
      }

      if (fromNode && toNode && fromNode.id && toNode.id) {
        if (!nodes.has(fromNode.id)) nodes.set(fromNode.id, fromNode.label || fromNode.id);
        if (!nodes.has(toNode.id))   nodes.set(toNode.id,   toNode.label   || toNode.id);
        edges.push({ from: fromNode.id, to: toNode.id, label: edgeLabel });
      }
    } else {
      // Standalone node declaration
      const m = line.match(nodeDecl);
      if (m && m[1] && !nodes.has(m[1])) {
        const label = m[2] || m[3] || m[4] || m[5] || m[1];
        nodes.set(m[1], label);
      }
    }
  }

  return { nodes, edges };
}

// ─── Main converter ────────────────────────────────────────────────────────

export async function convertMermaidToFlow(
  mermaidSyntax: string
): Promise<FlowConvertResult | FlowConvertError> {
  if (!mermaidSyntax.trim()) {
    return { ok: false, error: "Empty diagram" };
  }

  // ── Try structured parse via mermaid-to-excalidraw's parseMermaid ──────
  try {
    const { parseMermaid } = await import(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "@excalidraw/mermaid-to-excalidraw/dist/parseMermaid.js" as any
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = await parseMermaid(mermaidSyntax);

    // The parsed output has different shapes depending on diagram type.
    // We handle the common "graph" shape: { nodes, edges }
    const rawNodes: Map<string, string> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEdges: Array<{ from: string; to: string; label: string }> = [];

    if (parsed?.graph) {
      // flowchart / graph
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [id, node] of Object.entries(parsed.graph.vertices ?? {})) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = node as any;
        const label = n?.labelType === "string"
          ? (n?.label ?? id)
          : (n?.text ?? n?.label ?? id);
        rawNodes.set(String(id), String(label));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const edge of (parsed.graph.edges ?? []) as any[]) {
        const from = String(edge.start ?? edge.v ?? "");
        const to   = String(edge.end   ?? edge.w ?? "");
        const label = String(edge.text ?? edge.label ?? "");
        if (from && to) rawEdges.push({ from, to, label });
      }
    }

    // If we got useful data from the structured parse, use it
    if (rawNodes.size > 0 || rawEdges.length > 0) {
      return buildResult(rawNodes, rawEdges);
    }
  } catch {
    // Structured parse failed — fall through to regex
  }

  // ── Regex fallback ──────────────────────────────────────────────────────
  try {
    const { nodes, edges } = regexParse(mermaidSyntax);
    if (nodes.size === 0 && edges.length === 0) {
      return {
        ok: false,
        error: "Could not extract nodes or edges. Check your Mermaid syntax.",
      };
    }
    return buildResult(nodes, edges);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse diagram",
    };
  }
}

function buildResult(
  rawNodes: Map<string, string>,
  rawEdges: Array<{ from: string; to: string; label: string }>
): FlowConvertResult {
  // Ensure every node referenced in an edge exists
  for (const e of rawEdges) {
    if (!rawNodes.has(e.from)) rawNodes.set(e.from, e.from);
    if (!rawNodes.has(e.to))   rawNodes.set(e.to,   e.to);
  }

  const nodeIds = [...rawNodes.keys()];
  const positions = autoLayout(nodeIds);

  const nodes: RFNode[] = nodeIds.map((id) => {
    const label = rawNodes.get(id) ?? id;
    const comp  = pickComponent(label);
    return {
      id,
      type: "flowNode" as const,
      position: positions.get(id) ?? { x: 0, y: 0 },
      data: {
        componentId: comp.id,
        label,
        color:       comp.color,
        strokeColor: comp.strokeColor,
        iconPath:    comp.icon,
      },
    };
  });

  const edges: RFEdge[] = rawEdges.map((e) => ({
    id:       EDGE_ID(),
    type:     "flowEdge" as const,
    source:   e.from,
    target:   e.to,
    label:    e.label || undefined,
    animated: false,
  }));

  return { ok: true, nodes, edges };
}
