/**
 * Staff-engineer style critique — narrative challenges on top of lint.
 */

import { lintArchitecture, type LintIssue } from "@/lib/architecture/architecture-lint";
import { classifyHop } from "@/lib/architecture/story-path";
import { getComponent } from "@/lib/components-registry";

export type CritiqueSeverity = "block" | "challenge" | "nit";

export interface CritiqueCard {
  id: string;
  severity: CritiqueSeverity;
  title: string;
  voice: string;
  nodeIds: string[];
  fromLint?: boolean;
}

function outDegree(edges: { source: string }[], nodeId: string) {
  return edges.filter((e) => e.source === nodeId).length;
}

function inDegree(edges: { target: string }[], nodeId: string) {
  return edges.filter((e) => e.target === nodeId).length;
}

export function critiqueArchitecture(
  nodes: { id: string; data?: { componentId?: string; label?: string } }[],
  edges: { id: string; source: string; target: string; data?: { decisionWhy?: string } }[]
): CritiqueCard[] {
  const cards: CritiqueCard[] = [];
  const lint = lintArchitecture(nodes as never, edges as never);

  for (const issue of lint) {
    cards.push(lintToCritique(issue));
  }

  // Sync fan-out from compute without async
  for (const n of nodes) {
    const role = classifyHop(n.data?.componentId);
    if (role !== "Compute") continue;
    const outs = edges.filter((e) => e.source === n.id);
    if (outs.length < 3) continue;
    const hasAsync = outs.some((e) => {
      const t = nodes.find((x) => x.id === e.target);
      return classifyHop(t?.data?.componentId) === "Async";
    });
    if (!hasAsync) {
      cards.push({
        id: `fanout-${n.id}`,
        severity: "challenge",
        title: `${n.data?.label ?? "Service"} fans out synchronously`,
        voice:
          "Three+ downstream calls on the request path without a queue — latency stacks and partial failure gets ugly. Put non-critical work behind async.",
        nodeIds: [n.id, ...outs.map((e) => e.target)],
      });
    }
  }

  // Hot DB: high in-degree storage
  for (const n of nodes) {
    if (classifyHop(n.data?.componentId) !== "State") continue;
    const deg = inDegree(edges, n.id);
    if (deg < 3) continue;
    cards.push({
      id: `hotdb-${n.id}`,
      severity: "challenge",
      title: `${n.data?.label ?? "Store"} is a hot dependency`,
      voice: `${deg} services talk to this store. One slow query and you cascade. Cache, read replicas, or split bounded contexts.`,
      nodeIds: [n.id],
    });
  }

  // Missing decision why on edges into state/async
  for (const e of edges) {
    const tgt = nodes.find((n) => n.id === e.target);
    const role = classifyHop(tgt?.data?.componentId);
    if (role !== "State" && role !== "Async") continue;
    if (e.data?.decisionWhy?.trim()) continue;
    const src = nodes.find((n) => n.id === e.source);
    cards.push({
      id: `why-${e.id}`,
      severity: "nit",
      title: `No decision on ${src?.data?.label ?? "A"} → ${tgt?.data?.label ?? "B"}`,
      voice:
        "Staff ask: why this hop? Capture CAP, latency, or team skill in the decision ledger — otherwise the diagram is decoration.",
      nodeIds: [e.source, e.target],
    });
  }

  // Client → DB direct (extra narrative)
  for (const e of edges) {
    const src = nodes.find((n) => n.id === e.source);
    const tgt = nodes.find((n) => n.id === e.target);
    if (classifyHop(src?.data?.componentId) !== "Entry") continue;
    if (classifyHop(tgt?.data?.componentId) !== "State") continue;
    cards.push({
      id: `client-db-${e.id}`,
      severity: "block",
      title: "Client reaches durable state directly",
      voice:
        "Never expose the database to browsers or mobiles. Terminate at an API/gateway and keep credentials off the edge.",
      nodeIds: [e.source, e.target],
    });
  }

  // Orphan compute with no outbound
  for (const n of nodes) {
    const cat = getComponent(n.data?.componentId ?? "")?.category;
    if (cat !== "compute") continue;
    if (outDegree(edges, n.id) > 0 || inDegree(edges, n.id) > 0) continue;
    cards.push({
      id: `orphan-${n.id}`,
      severity: "nit",
      title: `${n.data?.label ?? "Compute"} is unconnected`,
      voice: "Dead node on the board — wire it or delete it before the interview.",
      nodeIds: [n.id],
    });
  }

  // Dedupe by id
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function lintToCritique(issue: LintIssue): CritiqueCard {
  const severity: CritiqueSeverity =
    issue.severity === "error" ? "block" : issue.severity === "warn" ? "challenge" : "nit";
  return {
    id: `lint-${issue.id}`,
    severity,
    title: issue.title,
    voice: issue.detail,
    nodeIds: issue.nodeIds,
    fromLint: true,
  };
}
