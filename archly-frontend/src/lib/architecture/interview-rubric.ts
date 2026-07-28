/**
 * Deterministic interview rubric for Flow graphs.
 */

import {
  classifyHop,
  findShortestPath,
  interviewOneLiner,
  pickDefaultEndId,
  pickDefaultStartId,
  type HopRole,
} from "@/lib/architecture/story-path";
import { getComponent } from "@/lib/components-registry";

export interface RubricItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface InterviewRubricResult {
  score: number;
  maxScore: number;
  percent: number;
  items: RubricItem[];
  oneLiner: string | null;
  tips: string[];
}

const ROLE_CHECKS: { role: HopRole; label: string; weight: number }[] = [
  { role: "Entry", label: "Entry (client)", weight: 1 },
  { role: "Edge", label: "Edge (LB / gateway / CDN)", weight: 1 },
  { role: "Compute", label: "Compute", weight: 1 },
  { role: "State", label: "Durable state", weight: 1 },
  { role: "Async", label: "Async (queue / worker)", weight: 1 },
];

export function scoreInterviewFlow(
  nodes: { id: string; data?: { componentId?: string; label?: string } }[],
  edges: { id: string; source: string; target: string }[]
): InterviewRubricResult {
  if (!nodes.length) {
    return {
      score: 0,
      maxScore: 8,
      percent: 0,
      items: [],
      oneLiner: null,
      tips: ["Switch to Flow and drop Entry → Edge → Compute → State at minimum."],
    };
  }

  const roles = new Set(nodes.map((n) => classifyHop(n.data?.componentId)));
  const items: RubricItem[] = [];
  let score = 0;
  let maxScore = 0;

  for (const check of ROLE_CHECKS) {
    maxScore += check.weight;
    const passed = roles.has(check.role);
    if (passed) score += check.weight;
    items.push({
      id: check.role,
      label: check.label,
      passed,
      detail: passed ? "Present on the board" : "Missing — interviewers notice",
    });
  }

  maxScore += 1;
  const hasObs = nodes.some(
    (n) => getComponent(n.data?.componentId ?? "")?.category === "observability"
  );
  if (hasObs) score += 1;
  items.push({
    id: "obs",
    label: "Observability",
    passed: hasObs,
    detail: hasObs ? "Metrics/logs/tracing present" : "Add at least one obs node",
  });

  maxScore += 1;
  const start = pickDefaultStartId(nodes);
  const end = pickDefaultEndId(nodes, start);
  const path = start ? findShortestPath(nodes, edges, start, end) : null;
  const hasPath = !!(path && path.nodeIds.length >= 3);
  if (hasPath) score += 1;
  items.push({
    id: "path",
    label: "Connected request path (3+ hops)",
    passed: hasPath,
    detail: hasPath
      ? `Path length ${path!.nodeIds.length}`
      : "Wire edges into a clear client→…→store path",
  });

  maxScore += 1;
  const clientDb = edges.some((e) => {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
    return (
      classifyHop(s?.data?.componentId) === "Entry" &&
      classifyHop(t?.data?.componentId) === "State"
    );
  });
  if (!clientDb) score += 1;
  items.push({
    id: "no-client-db",
    label: "No direct client → DB",
    passed: !clientDb,
    detail: clientDb ? "Clients must not hit the database" : "Edge/compute in front of state",
  });

  const tips = items.filter((i) => !i.passed).map((i) => i.detail);
  const oneLiner =
    path && path.nodeIds.length >= 2 ? interviewOneLiner(path.nodeIds, nodes) : null;

  return {
    score,
    maxScore,
    percent: Math.round((score / maxScore) * 100),
    items,
    oneLiner,
    tips,
  };
}

export function freehandRubricTips(): InterviewRubricResult {
  return {
    score: 0,
    maxScore: 8,
    percent: 0,
    items: ROLE_CHECKS.map((c) => ({
      id: c.role,
      label: c.label,
      passed: false,
      detail: "Rubric scores Flow graphs — promote or redraw in Flow",
    })),
    oneLiner: null,
    tips: [
      "Use Flow mode for auto-scoring, or checklist: client, edge, compute, store, failure mode, obs.",
    ],
  };
}
