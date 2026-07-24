"use client";

import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";

/**
 * Floating panel in the top-left of the Flow canvas
 * showing the ranked bottleneck list during simulation.
 */
export default function FlowBottleneckPanel() {
  const bottlenecks = useSimulationStore((s) => s.bottlenecks);
  const metrics     = useSimulationStore((s) => s.metrics);
  const nodes       = useFlowStore((s) => s.nodes);

  if (bottlenecks.length === 0) return null;

  const top5 = bottlenecks.slice(0, 5);

  return (
    <div style={{
      position: "absolute", top: 12, left: 12,
      zIndex: 50, pointerEvents: "none",
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 200,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "var(--pd-sim-bottleneck)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2,
      }}>
        ⚠ Bottleneck Ranking
      </div>
      {top5.map((b, i) => {
        const node  = nodes.find((n) => n.id === b.nodeId);
        const label = (node?.data as { label?: string })?.label ?? b.nodeId.slice(0, 8);
        const m     = metrics[b.nodeId];
        return (
          <div key={b.nodeId} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "color-mix(in srgb, var(--pd-surface) 88%, transparent)",
            border: "1px solid var(--pd-border)",
            borderRadius: "var(--pd-radius)",
            padding: "5px 10px",
            backdropFilter: "blur(8px)",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: "var(--pd-text-subtle)",
              minWidth: 14,
            }}>#{i + 1}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--pd-text)",
              flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{label}</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: m?.isBottleneck ? "var(--pd-sim-bottleneck)" : "var(--pd-text-muted)",
            }}>
              {b.reason}
            </span>
          </div>
        );
      })}
    </div>
  );
}
