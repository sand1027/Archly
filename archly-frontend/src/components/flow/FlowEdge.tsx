"use client";

import { memo, useState, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useSimulationStore } from "@/store/simulation.store";

const PACKET_COUNT = 3;

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
  const hasCrash     = srcInjection?.type === "crash";

  const durationMs  = Math.round(1400 / speed);
  const packetCount = Math.max(1, Math.round(PACKET_COUNT * trafficMultiplier));

  const isHighlighted = hovered || selected;

  const edgeColor = hasCrash
    ? "var(--pd-sim-error)"
    : isRunning
    ? "var(--pd-brand)"
    : isHighlighted
    ? "var(--pd-brand)"
    : "var(--pd-border-strong)";

  const edgeStrokeWidth = isHighlighted ? 2 : isRunning ? 1.5 : 1;

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteElements({ edges: [{ id }] });
    },
    [id, deleteElements]
  );

  const showLabel = isHighlighted || (isRunning && !!srcMetrics);

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
          stroke: edgeColor,
          strokeWidth: edgeStrokeWidth,
          strokeDasharray: isRunning ? "none" : "4 3",
          transition: "stroke 150ms, stroke-width 150ms",
          opacity: isRunning ? 1 : isHighlighted ? 1 : 0.55,
          pointerEvents: "none", // handled by the hit area above
          ...style,
        }}
      />

      {/* ── Animated packet dots ── */}
      {isRunning && !hasCrash && (
        <PacketDots
          edgePath={edgePath}
          count={packetCount}
          durationMs={durationMs}
          errorRate={errorRate}
        />
      )}

      {/* ── Label: delete button on hover / traffic rate during sim ── */}
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
            {/* Traffic badge — shown during simulation */}
            {isRunning && srcMetrics && (
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

            {/* Delete button — shown on hover */}
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

function PacketDots({ edgePath, count, durationMs, errorRate }: {
  edgePath: string;
  count: number;
  durationMs: number;
  errorRate: number;
}) {
  const dots = Array.from({ length: count }, (_, i) => {
    const isError = Math.random() < errorRate;
    const delay   = -(durationMs * (i / count));
    return (
      <circle
        key={i}
        r={3.5}
        fill={isError ? "var(--pd-sim-error)" : "var(--pd-sim-packet)"}
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
