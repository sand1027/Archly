"use client";

import { useMemo, type CSSProperties } from "react";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { useCanvasStore } from "@/store/canvas.store";
import { getComponent } from "@/lib/components-registry";

interface BottleneckReportProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BottleneckReport({ isOpen, onClose }: BottleneckReportProps) {
  const metrics = useSimulationStore((s) => s.metrics);
  const bottlenecks = useSimulationStore((s) => s.bottlenecks);
  const activeInjections = useSimulationStore((s) => s.activeInjections);
  const flowNodes = useFlowStore((s) => s.nodes);
  const canvasElements = useCanvasStore((s) => s.elements);

  const rows = useMemo(() => {
    const ids =
      bottlenecks.length > 0
        ? bottlenecks.map((b) => b.nodeId)
        : Object.keys(metrics).filter((id) => metrics[id]?.isBottleneck);

    return ids.map((nodeId, i) => {
      const m = metrics[nodeId];
      const b = bottlenecks.find((x) => x.nodeId === nodeId);
      const flowNode = flowNodes.find((n) => n.id === nodeId);
      const el = canvasElements.find((e) => e.id === nodeId);
      const flowLabel = (flowNode?.data as { label?: string } | undefined)?.label;
      const canvasLabel = el?.customData?.label as string | undefined;
      const compId =
        (flowNode?.data as { componentId?: string } | undefined)?.componentId ??
        (el?.customData?.componentId as string | undefined);
      const comp = compId ? getComponent(compId) : null;
      const label = flowLabel ?? canvasLabel ?? comp?.name ?? nodeId.slice(0, 10);

      return {
        rank: i + 1,
        nodeId,
        label,
        reason: b?.reason ?? (m?.isBottleneck ? "Saturated" : "—"),
        rps: m?.rps ?? 0,
        latency: m?.latencyP99 ?? m?.latencyAvg ?? 0,
        errorRate: m?.errorRate ?? 0,
        cpu: m?.cpuPercent ?? 0,
      };
    });
  }, [bottlenecks, metrics, flowNodes, canvasElements]);

  if (!isOpen) return null;

  return (
    <div role="presentation" onClick={onClose} style={overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottleneck-report-title"
        onClick={(e) => e.stopPropagation()}
        style={card}
      >
        <div style={header}>
          <div>
            <h2 id="bottleneck-report-title" style={titleStyle}>
              Bottleneck report
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--pd-text-muted)" }}>
              {rows.length > 0
                ? `${rows.length} bottleneck node${rows.length === 1 ? "" : "s"}`
                : "No bottlenecks yet — run the simulation under load"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeBtn}>
            ✕
          </button>
        </div>

        {activeInjections.length > 0 && (
          <div style={chaosBanner}>
            Active chaos: {activeInjections.length} injection
            {activeInjections.length === 1 ? "" : "s"} (
            {activeInjections.map((i) => i.type).join(", ")})
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px" }}>
          {rows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--pd-text-muted)", lineHeight: 1.5, margin: 0 }}>
              Start the simulation and raise traffic to surface bottlenecks. They appear here with
              RPS, latency, and error rate.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => (
                <div key={r.nodeId} style={rowCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={rankBadge}>#{r.rank}</span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: "var(--pd-text)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--pd-sim-bottleneck)", marginBottom: 8 }}>
                    {r.reason}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <Stat label="RPS" value={formatRps(r.rps)} />
                    <Stat label="Latency" value={`${Math.round(r.latency)}ms`} warn={r.latency > 200} />
                    <Stat
                      label="Errors"
                      value={`${(r.errorRate * 100).toFixed(0)}%`}
                      warn={r.errorRate > 0.05}
                      danger={r.errorRate > 0.2}
                    />
                    <Stat label="CPU" value={`${Math.round(r.cpu)}%`} warn={r.cpu > 70} danger={r.cpu > 90} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
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
  const color = danger
    ? "var(--pd-sim-error)"
    : warn
      ? "var(--pd-sim-warn)"
      : "var(--pd-text)";
  return (
    <div style={{ minWidth: 56 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: "var(--pd-text-subtle)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function formatRps(rps: number): string {
  if (rps >= 1000) return `${(rps / 1000).toFixed(1)}k`;
  return String(Math.round(rps));
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 400,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(440px, 100%)",
  maxHeight: "min(560px, 90vh)",
  display: "flex",
  flexDirection: "column",
  background: "var(--pd-surface-raised)",
  border: "1px solid var(--pd-border)",
  borderRadius: "var(--pd-radius-lg, 12px)",
  boxShadow: "var(--pd-shadow)",
  overflow: "hidden",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 16px 12px",
  borderBottom: "1px solid var(--pd-border)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "var(--pd-text)",
};

const closeBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
};

const chaosBanner: CSSProperties = {
  padding: "8px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--pd-sim-error)",
  background: "color-mix(in srgb, var(--pd-sim-error) 10%, transparent)",
  borderBottom: "1px solid var(--pd-border)",
};

const rowCard: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
};

const rankBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "var(--pd-sim-bottleneck)",
  background: "color-mix(in srgb, var(--pd-sim-bottleneck) 14%, transparent)",
  padding: "2px 6px",
  borderRadius: 999,
};
