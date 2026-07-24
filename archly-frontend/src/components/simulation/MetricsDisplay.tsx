"use client";

/**
 * MetricsDisplay — floating panel showing per-node metrics ranked by bottleneck score.
 * Appears when simulation is running. Positioned top-right of the canvas area.
 */

import { useSimulationStore } from "@/store/simulation.store";
import { useCanvasStore } from "@/store/canvas.store";
import { getComponent } from "@/lib/components-registry";

export default function MetricsDisplay() {
  const { isRunning, metrics, bottlenecks } = useSimulationStore();
  const { elements } = useCanvasStore();

  if (!isRunning || Object.keys(metrics).length === 0) return null;

  // Show top 6 nodes by bottleneck score, then sort rest by nodeId for stability
  const topIds = new Set(bottlenecks.slice(0, 3).map((b) => b.nodeId));
  const displayNodes = Object.values(metrics)
    .sort((a, b) => {
      const aTop = topIds.has(a.nodeId) ? 1 : 0;
      const bTop = topIds.has(b.nodeId) ? 1 : 0;
      return bTop - aTop || b.rps - a.rps;
    })
    .slice(0, 6);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: "var(--pd-z-panel)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "none",
        minWidth: 200,
        maxWidth: 240,
      }}
    >
      {displayNodes.map((m) => {
        const element = elements.find((e) => e.id === m.nodeId);
        const compId = element?.customData?.componentId as string | undefined;
        const comp = compId ? getComponent(compId) : null;
        const label =
          (element?.customData?.label as string) ??
          comp?.name ??
          m.nodeId.slice(0, 8);

        const isCrashed = m.errorRate >= 1;
        const isBottleneck = m.isBottleneck;

        return (
          <div
            key={m.nodeId}
            style={{
              background: isCrashed
                ? "rgba(239,68,68,0.12)"
                : isBottleneck
                ? "rgba(249,115,22,0.1)"
                : "rgba(0,0,0,0.55)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${
                isCrashed
                  ? "rgba(239,68,68,0.4)"
                  : isBottleneck
                  ? "rgba(249,115,22,0.3)"
                  : "rgba(255,255,255,0.08)"
              }`,
              borderRadius: "var(--pd-radius)",
              padding: "6px 10px",
            }}
          >
            {/* Node name row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isCrashed
                    ? "var(--pd-sim-error)"
                    : isBottleneck
                    ? "var(--pd-sim-bottleneck)"
                    : "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 130,
                }}
              >
                {comp?.icon ? `${comp.icon} ` : ""}
                {label}
              </div>
              {isCrashed && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--pd-sim-error)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  CRASHED
                </span>
              )}
              {!isCrashed && isBottleneck && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--pd-sim-bottleneck)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  BOTTLENECK
                </span>
              )}
            </div>

            {/* Metric pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <MetricPill label="RPS" value={formatRps(m.rps)} />
              <MetricPill
                label="p99"
                value={`${m.latencyP99}ms`}
                warn={m.latencyP99 > 200}
                danger={m.latencyP99 > 1000}
              />
              <MetricPill
                label="err"
                value={`${(m.errorRate * 100).toFixed(0)}%`}
                warn={m.errorRate > 0.05}
                danger={m.errorRate > 0.2}
              />
              <MetricPill
                label="cpu"
                value={`${m.cpuPercent}%`}
                warn={m.cpuPercent > 70}
                danger={m.cpuPercent > 90}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricPill({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: string;
  warn?: boolean;
  danger?: boolean;
}) {
  const color = danger ? "#ef4444" : warn ? "#f59e0b" : "rgba(255,255,255,0.7)";
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "baseline" }}>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function formatRps(rps: number): string {
  if (rps >= 1000) return `${(rps / 1000).toFixed(1)}k`;
  return String(rps);
}
