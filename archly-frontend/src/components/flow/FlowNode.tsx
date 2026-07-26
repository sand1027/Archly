"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getChaosType } from "@/lib/simulation/chaos";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore, type FlowNodeData } from "@/store/flow.store";
import type { FlowNode } from "@/store/flow.store";

/**
 * Custom React Flow node for system design components.
 *
 * Layout (matching archly component card style):
 * ┌─────────────────────────────┐
 * │  [icon]  Label              │  ← top section
 * │─────────────────────────────│
 * │  RPS: 1.2k  p99: 45ms      │  ← metrics row (simulation only)
 * │  CPU: 34%   Err: 0.1%      │
 * └─────────────────────────────┘
 *
 * Handles: left (target) + right (source) + top (target) + bottom (source)
 * This gives maximum flexibility for drawing connections.
 */
const FlowNode = memo(({ id, data, selected }: NodeProps<FlowNode>) => {
  const { componentId, label, color, strokeColor, iconPath } = data as FlowNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(label);

  const isRunning  = useSimulationStore((s) => s.isRunning);
  const metrics    = useSimulationStore((s) => s.metrics);
  const injections = useSimulationStore((s) => s.activeInjections);
  const updateLabel = useFlowStore((s) => s.updateNodeLabel);

  const m          = metrics[id];
  const nodeInj    = injections.filter((i) => i.nodeId === id);
  const primaryInj = nodeInj[nodeInj.length - 1]; // latest chaos wins visually
  const chaosDef   = primaryInj ? getChaosType(primaryInj.type) : null;
  const isCrashed  = primaryInj?.type === "crash" || (!!m && m.errorRate >= 1);
  const isBottle   = m && m.isBottleneck && !isCrashed;

  // Chaos color always wins over idle stroke; selection adds an outer ring.
  const borderColor = chaosDef ? chaosDef.color : strokeColor;

  const handleLabelCommit = () => {
    setIsEditing(false);
    if (editLabel.trim()) updateLabel(id, editLabel.trim());
    else setEditLabel(label);
  };

  return (
    <div
      style={{
        width: 160,
        borderRadius: "var(--pd-radius-lg)",
        background: "var(--pd-surface)",
        border: `2px solid ${borderColor}`,
        boxShadow: [
          selected ? `0 0 0 3px color-mix(in srgb, var(--pd-brand) 35%, transparent)` : null,
          chaosDef ? `0 0 14px color-mix(in srgb, ${chaosDef.color} 45%, transparent)` : null,
          "var(--pd-shadow-sm)",
        ].filter(Boolean).join(", "),
        transition: "border-color 150ms, box-shadow 150ms",
        overflow: "hidden",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
        userSelect: "none",
      }}
    >
      {/* ── Handles — all 4 sides, each side has source+target ─── */}
      {/* Left */}
      <Handle type="target" position={Position.Left}  id="left-t"  style={{ ...handleStyle(strokeColor), top: "40%" }} />
      <Handle type="source" position={Position.Left}  id="left-s"  style={{ ...handleStyle(strokeColor), top: "60%" }} />
      {/* Right */}
      <Handle type="target" position={Position.Right} id="right-t" style={{ ...handleStyle(strokeColor), top: "40%" }} />
      <Handle type="source" position={Position.Right} id="right-s" style={{ ...handleStyle(strokeColor), top: "60%" }} />
      {/* Top */}
      <Handle type="target" position={Position.Top}   id="top-t"   style={{ ...handleStyle(strokeColor), left: "40%" }} />
      <Handle type="source" position={Position.Top}   id="top-s"   style={{ ...handleStyle(strokeColor), left: "60%" }} />
      {/* Bottom */}
      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ ...handleStyle(strokeColor), left: "40%" }} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" style={{ ...handleStyle(strokeColor), left: "60%" }} />

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 10px 8px",
        background: `color-mix(in srgb, ${color} 60%, var(--pd-surface))`,
        borderBottom: `1px solid color-mix(in srgb, ${strokeColor} 20%, transparent)`,
      }}>
        {/* Icon */}
        <div style={{
          width: 28, height: 28,
          borderRadius: "var(--pd-radius-sm)",
          background: color,
          border: `1.5px solid ${strokeColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg
            viewBox="0 0 24 24" width={14} height={14}
            fill="none" stroke={strokeColor}
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" overflow="hidden"
            style={{ display: "block" }}
          >
            <path d={iconPath} />
          </svg>
        </div>

        {/* Label — double-click to edit */}
        {isEditing ? (
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleLabelCommit}
            onKeyDown={(e) => { if (e.key === "Enter") handleLabelCommit(); if (e.key === "Escape") { setIsEditing(false); setEditLabel(label); } }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0,
              background: "var(--pd-surface)",
              border: `1px solid var(--pd-brand)`,
              borderRadius: "var(--pd-radius-sm)",
              padding: "2px 5px",
              fontSize: 11, fontWeight: 600, color: "var(--pd-text)",
              outline: "none",
            }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            title="Double-click to rename"
            style={{
              fontSize: 11, fontWeight: 700, color: "var(--pd-text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, minWidth: 0, cursor: "text",
            }}
          >
            {label}
          </span>
        )}

        {/* Status dot — colored by chaos type */}
        {chaosDef && (
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: chaosDef.color,
            boxShadow: `0 0 6px ${chaosDef.color}`,
            animation: isCrashed ? undefined : "packet-pulse 1s ease-in-out infinite",
          }} title={chaosDef.label} />
        )}
      </div>

      {/* ── Live metrics (simulation only) ──────────────── */}
      {isRunning && m && (
        <div style={{
          padding: "6px 10px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3px 8px",
        }}>
          <MetricRow label="RPS"  value={formatRps(m.rps)}           />
          <MetricRow label="p99"  value={`${m.latencyP99}ms`}        warn={m.latencyP99 > 200} danger={m.latencyP99 > 1000} />
          <MetricRow label="CPU"  value={`${m.cpuPercent}%`}         warn={m.cpuPercent > 70} danger={m.cpuPercent > 90} />
          <MetricRow label="Err"  value={`${(m.errorRate * 100).toFixed(1)}%`} warn={m.errorRate > 0.05} danger={m.errorRate > 0.2} />
        </div>
      )}

      {/* ── Bottleneck banner ───────────────────────────── */}
      {isBottle && (
        <div style={{
          padding: "3px 10px",
          background: "color-mix(in srgb, var(--pd-sim-bottleneck) 12%, transparent)",
          borderTop: "1px solid color-mix(in srgb, var(--pd-sim-bottleneck) 30%, transparent)",
          fontSize: 9, fontWeight: 800, color: "var(--pd-sim-bottleneck)",
          textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
        }}>
          ⚠ Bottleneck
        </div>
      )}

      {/* ── Chaos banner (every type, not just crash) ───── */}
      {chaosDef && (
        <div style={{
          padding: "4px 10px",
          background: `color-mix(in srgb, ${chaosDef.color} 16%, transparent)`,
          borderTop: `1px solid color-mix(in srgb, ${chaosDef.color} 35%, transparent)`,
          fontSize: 9, fontWeight: 800, color: chaosDef.color,
          textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <span aria-hidden>{chaosDef.icon}</span>
          <span>{chaosDef.label}</span>
          {nodeInj.length > 1 && (
            <span style={{ opacity: 0.7 }}>+{nodeInj.length - 1}</span>
          )}
        </div>
      )}
    </div>
  );
});

FlowNode.displayName = "FlowNode";
export default FlowNode;

// ─── Helpers ──────────────────────────────────────────────────────────────

function handleStyle(color: string): React.CSSProperties {
  return {
    width: 10, height: 10,
    background: "var(--pd-surface)",
    border: `2px solid ${color}`,
    borderRadius: "50%",
    transition: "transform 120ms",
  };
}

function MetricRow({ label, value, warn, danger }: {
  label: string; value: string; warn?: boolean; danger?: boolean;
}) {
  const color = danger
    ? "var(--pd-sim-error)"
    : warn
    ? "var(--pd-sim-warn)"
    : "var(--pd-text-muted)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ fontSize: 9, color: "var(--pd-text-subtle)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function formatRps(rps: number): string {
  if (rps >= 1000) return `${(rps / 1000).toFixed(1)}k`;
  return String(rps);
}
