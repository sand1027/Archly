/**
 * Rough monthly cost + RPS capacity ghosts for Flow nodes.
 */

import { getComponent } from "@/lib/components-registry";
import type { NodeConfig } from "@/store/canvas.store";

export interface NodeCostEstimate {
  monthlyUsd: number;
  rpsHint: number;
  label: string;
}

const BASE_BY_CATEGORY: Record<string, { usd: number; rps: number }> = {
  clients: { usd: 0, rps: 0 },
  traffic_edge: { usd: 40, rps: 5000 },
  compute: { usd: 80, rps: 800 },
  storage: { usd: 60, rps: 2000 },
  messaging: { usd: 50, rps: 3000 },
  observability: { usd: 30, rps: 0 },
  network: { usd: 25, rps: 2000 },
  ai_agents: { usd: 120, rps: 50 },
  external: { usd: 20, rps: 500 },
};

const BASE_BY_ID: Record<string, { usd: number; rps: number }> = {
  client: { usd: 0, rps: 0 },
  mobile: { usd: 0, rps: 0 },
  web_browser: { usd: 0, rps: 0 },
  cdn: { usd: 90, rps: 20000 },
  cloudflare: { usd: 70, rps: 25000 },
  load_balancer: { usd: 45, rps: 10000 },
  api_gateway: { usd: 55, rps: 8000 },
  app_server: { usd: 90, rps: 600 },
  worker: { usd: 70, rps: 400 },
  serverless: { usd: 40, rps: 1500 },
  sql_db: { usd: 120, rps: 1500 },
  nosql_db: { usd: 100, rps: 2500 },
  cache: { usd: 50, rps: 20000 },
  message_queue: { usd: 45, rps: 5000 },
  kafka: { usd: 180, rps: 15000 },
  llm_gateway: { usd: 200, rps: 30 },
};

function parseReplicas(cfg?: NodeConfig): number {
  if (!cfg?.replicas) return 1;
  const n = parseInt(String(cfg.replicas), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseRpsOverride(cfg?: NodeConfig): number | null {
  if (!cfg?.rpsCapacity || cfg.rpsCapacity === "default") return null;
  const n = parseInt(String(cfg.rpsCapacity).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function estimateNodeCost(
  componentId: string | undefined | null,
  cfg?: NodeConfig
): NodeCostEstimate {
  const def = componentId ? getComponent(componentId) : undefined;
  const byId = componentId ? BASE_BY_ID[componentId] : undefined;
  const byCat = def ? BASE_BY_CATEGORY[def.category] : undefined;
  const base = byId ?? byCat ?? { usd: 40, rps: 500 };
  const replicas = parseReplicas(cfg);
  const rpsOverride = parseRpsOverride(cfg);
  return {
    monthlyUsd: Math.round(base.usd * replicas),
    rpsHint: rpsOverride ?? base.rps * replicas,
    label: def?.name ?? componentId ?? "node",
  };
}

export function estimateGraphCost(
  nodes: { id: string; data?: { componentId?: string } }[],
  getConfig?: (nodeId: string) => NodeConfig | undefined
): { monthlyUsd: number; totalRpsHint: number } {
  let monthlyUsd = 0;
  let totalRpsHint = 0;
  for (const n of nodes) {
    const e = estimateNodeCost(n.data?.componentId, getConfig?.(n.id));
    monthlyUsd += e.monthlyUsd;
    if (e.rpsHint > totalRpsHint) totalRpsHint = e.rpsHint;
  }
  return { monthlyUsd, totalRpsHint };
}
