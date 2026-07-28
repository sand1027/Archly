/**
 * Constraint lint — design under pinned product/ops rules.
 */

import { hopLatencyMs, classifyHop } from "@/lib/architecture/story-path";
import { estimateNodeCost } from "@/lib/architecture/cost-estimates";
import type { ArchConstraints, BudgetTier } from "@/store/architecture-studio.store";
import type { NodeConfig } from "@/store/canvas.store";

export interface ConstraintIssue {
  id: string;
  severity: "error" | "warn" | "info";
  title: string;
  detail: string;
  nodeIds: string[];
}

const BUDGET_CAP: Record<Exclude<BudgetTier, "none">, number> = {
  low: 200,
  mid: 1500,
  high: 8000,
};

/** Component ids treated as non-EU / hard to GDPR-localize in v1 heuristics */
const GDPR_RISKY = new Set([
  "dynamodb",
  "cloudflare",
  "fastly",
  "gcs",
  "pinecone",
  "weaviate",
]);

const MULTI_REGION_HINTS = new Set([
  "cdn",
  "cloudflare",
  "fastly",
  "anycast_lb",
  "cockroachdb",
  "cassandra",
  "scylladb",
  "dynamodb",
]);

export function lintConstraints(
  nodes: { id: string; data?: { componentId?: string; label?: string } }[],
  edges: { source: string; target: string }[],
  constraints: ArchConstraints,
  getConfig?: (nodeId: string) => NodeConfig | undefined
): ConstraintIssue[] {
  const issues: ConstraintIssue[] = [];
  if (!nodes.length) return issues;

  if (constraints.multiRegion) {
    const hasHint = nodes.some((n) => MULTI_REGION_HINTS.has(n.data?.componentId ?? ""));
    if (!hasHint) {
      issues.push({
        id: "mr-missing",
        severity: "error",
        title: "Multi-region constraint unmet",
        detail:
          "No CDN, anycast LB, or multi-region store on the board. Add edge presence or a globally distributed database.",
        nodeIds: [],
      });
    }
  }

  if (constraints.gdpr) {
    const risky = nodes.filter((n) => GDPR_RISKY.has(n.data?.componentId ?? ""));
    if (risky.length) {
      issues.push({
        id: "gdpr-risky",
        severity: "warn",
        title: "GDPR: review data residency",
        detail: `${risky.map((n) => n.data?.label ?? n.id).join(", ")} often imply US/global processing — pin region or swap for EU-controllable equivalents.`,
        nodeIds: risky.map((n) => n.id),
      });
    }
  }

  if (constraints.p99Under200) {
    const estimate = nodes.reduce((s, n) => s + hopLatencyMs(n.data?.componentId), 0);
    if (estimate > 200) {
      issues.push({
        id: "p99-budget",
        severity: "warn",
        title: `Latency budget at risk (~${estimate}ms hop sum)`,
        detail:
          "Pinned p99 < 200ms. Trim hops, cache reads, or move work off the sync path.",
        nodeIds: nodes.filter((n) => classifyHop(n.data?.componentId) === "State").map((n) => n.id),
      });
    }
  }

  if (constraints.budgetUnder !== "none") {
    const cap = BUDGET_CAP[constraints.budgetUnder];
    let total = 0;
    for (const n of nodes) {
      const cfg = getConfig?.(n.id);
      total += estimateNodeCost(n.data?.componentId, cfg).monthlyUsd;
    }
    if (total > cap) {
      issues.push({
        id: "budget",
        severity: "error",
        title: `Cost ~$${Math.round(total)}/mo exceeds ${constraints.budgetUnder} tier ($${cap})`,
        detail: "Drop replicas, shrink compute, or use serverless/cache to fit the constraint.",
        nodeIds: [],
      });
    }
  }

  void edges;

  return issues;
}
