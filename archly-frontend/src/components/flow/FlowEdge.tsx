"use client";

import { memo, useState, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { getChaosType } from "@/lib/simulation/chaos";
import { useSimulationStore } from "@/store/simulation.store";
import type { ChaosType } from "@/types";

const PACKET_COUNT = 3;

function edgeStyleForChaos(type: ChaosType | undefined, isRunning: boolean, isHighlighted: boolean): {
  color: string;
  dash: string;
  showPackets: boolean;
  packetScale: number;
  durationScale: number;
} {
  switch (type) {
    case "crash":
      return { color: "#e53e3e", dash: "none", showPackets: false, packetScale: 0, durationScale: 1 };
    case "zero":
      return { color: "#6b7280", dash: "2 6", showPackets: false, packetScale: 0, durationScale: 1 };
    case "partition":
      return { color: "#db2777", dash: "8 6", showPackets: true, packetScale: 0.4, durationScale: 1.6 };
    case "slow":
      return { color: "#d97706", dash: "none", showPackets: true, packetScale: 0.7, durationScale: 2.2 };
    case "throttle":
      return { color: "#ea6c00", dash: "4 4", showPackets: true, packetScale: 0.35, durationScale: 1.8 };
    case "surge":
      return { color: "#7c3aed", dash: "none", showPackets: true, packetScale: 2.2, durationScale: 0.55 };
    case "canary":
      return { color: "#0891b2", dash: "6 3", showPackets: true, packetScale: 1, durationScale: 1 };
    default:
      return {
        color: isRunning || isHighlighted ? "var(--pd-brand)" : "var(--pd-border-strong)",
        dash: isRunning ? "none" : "4 3",
        showPackets: true,
        packetScale: 1,
        durationScale: 1,
      };
  }
}

const FlowEdge = memo(({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  style,
  markerEnd,
  source,
  selected,
}: EdgeProps) => {
  const { deleteElements } = useReactFlow();
  const [hovered, setHovered] = useState(false);

  const isRunning         = useSimulationStore((s) => s.isRunning);
  const trafficMultiplier = useSimulationStore((s) => s.trafficMultiplier);
  const speed             = useSimulationStore((s) => s.speed);
  const metrics           = useSimulationStore((s) => s.metrics);
  const activeInjections  = useSimulationStore((s) => s.activeInjections);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const srcMetrics   = metrics[source];
  const srcInjection = activeInjections.find((i) => i.nodeId === source);
  const errorRate    = srcMetrics?.errorRate ?? 0;
  const chaos        = edgeStyleForChaos(srcInjection?.type, isRunning, !!(hovered || selected));

  const durationMs  = Math.round((1400 / speed) * chaos.durationScale);
  const packetCount = Math.max(1, Math.round(PACKET_COUNT * trafficMultiplier * chaos.packetScale));

  const isHighlighted = hovered || selected;
  const edgeStrokeWidth = isHighlighted ? 2.5 : isRunning || srcInjection ? 2 : 1;

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteElements({ edges: [{ id }] });
    },
    [id, deleteElements]
  );

  const showLabel = isHighlighted || (isRunning && !!srcMetrics) || !!srcInjection;

  return (
    <>
      {/* ── Invisible wide hit area so hover triggers easily ── */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* ── Visible path ── */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: chaos.color,
          strokeWidth: edgeStrokeWidth,
          strokeDasharray: chaos.dash,
          transition: "stroke 150ms, stroke-width 150ms",
          opacity: isRunning || srcInjection ? 1 : isHighlighted ? 1 : 0.55,
          pointerEvents: "none",
          ...style,
        }}
      />

      {/* ── Animated packet dots ── */}
      {isRunning && chaos.showPackets && (
        <PacketDots
          edgePath={edgePath}
          count={packetCount}
          durationMs={durationMs}
          errorRate={errorRate}
          canary={srcInjection?.type === "canary"}
        />
      )}

      {/* ── Label: delete / chaos / traffic ── */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 4,
              pointerEvents: "all",
            }}
          >
            {srcInjection && (
              <div style={{
                background: getChaosType(srcInjection.type).color,
                color: "#fff",
                borderRadius: "var(--pd-radius-full)",
                padding: "1px 7px",
                fontSize: 9,
                fontWeight: 800,
                whiteSpace: "nowrap",
                boxShadow: "var(--pd-shadow-sm)",
                userSelect: "none",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                {getChaosType(srcInjection.type).label}
              </div>
            )}

            {isRunning && srcMetrics && !srcInjection && (
              <div style={{
                background: "var(--pd-surface)",
                border: "1px solid var(--pd-border)",
                borderRadius: "var(--pd-radius-full)",
                padding: "1px 7px",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--pd-text-muted)",
                whiteSpace: "nowrap",
                boxShadow: "var(--pd-shadow-sm)",
                userSelect: "none",
              }}>
                {formatRps(srcMetrics.rps)}
              </div>
            )}

            {isHighlighted && (
              <button
                onClick={handleDelete}
                title="Delete connection"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: "1.5px solid var(--pd-sim-error)",
                  background: "var(--pd-surface)",
                  color: "var(--pd-sim-error)",
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--pd-shadow)",
                  transition: "background 120ms, color 120ms",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--pd-sim-error)";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--pd-surface)";
                  (e.currentTarget as HTMLElement).style.color = "var(--pd-sim-error)";
                }}
              >
                ✕
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

FlowEdge.displayName = "FlowEdge";
export default FlowEdge;

// ─── Packet dots ──────────────────────────────────────────────────────────

function PacketDots({ edgePath, count, durationMs, errorRate, canary }: {
  edgePath: string;
  count: number;
  durationMs: number;
  errorRate: number;
  canary?: boolean;
}) {
  const dots = Array.from({ length: count }, (_, i) => {
    const isError = Math.random() < errorRate;
    const delay   = -(durationMs * (i / count));
    const fill = isError
      ? "var(--pd-sim-error)"
      : canary && i % 3 === 0
      ? "#0891b2"
      : "var(--pd-sim-packet)";
    return (
      <circle
        key={i}
        r={3.5}
        fill={fill}
        opacity={0.9}
        style={{
          offsetPath: `path('${edgePath}')`,
          offsetDistance: "0%",
          animation: `flow-packet ${durationMs}ms linear ${delay}ms infinite`,
          willChange: "offset-distance",
          pointerEvents: "none",
        } as React.CSSProperties}
      />
    );
  });
  return <>{dots}</>;
}

function formatRps(rps: number): string {
  if (rps >= 1000) return `${(rps / 1000).toFixed(1)}k/s`;
  return `${rps}/s`;
}
