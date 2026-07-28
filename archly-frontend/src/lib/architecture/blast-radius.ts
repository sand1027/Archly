/**
 * Blast radius — downstream dies, upstream degrades.
 */

export type BlastSeverity = "epicenter" | "down" | "degraded" | "ok";

export interface BlastResult {
  epicenterId: string;
  downIds: string[];
  degradedIds: string[];
  /** nodeId → severity */
  severity: Record<string, BlastSeverity>;
}

export function computeBlastRadius(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
  epicenterId: string
): BlastResult | null {
  if (!nodes.some((n) => n.id === epicenterId)) return null;

  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const e of edges) {
    if (!forward.has(e.source)) forward.set(e.source, []);
    forward.get(e.source)!.push(e.target);
    if (!reverse.has(e.target)) reverse.set(e.target, []);
    reverse.get(e.target)!.push(e.source);
  }

  const down = new Set<string>();
  const q = [epicenterId];
  const seenF = new Set<string>([epicenterId]);
  while (q.length) {
    const cur = q.shift()!;
    for (const t of forward.get(cur) ?? []) {
      if (seenF.has(t)) continue;
      seenF.add(t);
      down.add(t);
      q.push(t);
    }
  }

  const degraded = new Set<string>();
  const q2 = [epicenterId];
  const seenR = new Set<string>([epicenterId]);
  while (q2.length) {
    const cur = q2.shift()!;
    for (const s of reverse.get(cur) ?? []) {
      if (seenR.has(s)) continue;
      seenR.add(s);
      if (!down.has(s) && s !== epicenterId) degraded.add(s);
      q2.push(s);
    }
  }

  const severity: Record<string, BlastSeverity> = {};
  for (const n of nodes) {
    if (n.id === epicenterId) severity[n.id] = "epicenter";
    else if (down.has(n.id)) severity[n.id] = "down";
    else if (degraded.has(n.id)) severity[n.id] = "degraded";
    else severity[n.id] = "ok";
  }

  return {
    epicenterId,
    downIds: [...down],
    degradedIds: [...degraded],
    severity,
  };
}
