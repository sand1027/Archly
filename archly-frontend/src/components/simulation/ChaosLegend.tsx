"use client";

import { CHAOS_TYPES } from "@/lib/simulation/chaos";

interface Props {
  compact?: boolean;
}

export default function ChaosLegend({ compact }: Props) {
  return (
    <div
      className="chaos-legend"
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 45,
        display: "flex",
        flexDirection: compact ? "row" : "column",
        flexWrap: "wrap",
        gap: compact ? 6 : 4,
        padding: compact ? "6px 10px" : "8px 10px",
        maxWidth: compact ? "min(92vw, 520px)" : 160,
        borderRadius: "var(--pd-radius-lg)",
        background: "color-mix(in srgb, var(--pd-surface) 92%, transparent)",
        border: "1px solid var(--pd-border)",
        boxShadow: "var(--pd-shadow-sm)",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      {!compact && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--pd-text-subtle)",
            marginBottom: 2,
          }}
        >
          Chaos
        </div>
      )}
      {CHAOS_TYPES.map((ct) => (
        <div
          key={ct.type}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--pd-text-muted)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: ct.color,
              flexShrink: 0,
              boxShadow: `0 0 6px ${ct.color}`,
            }}
          />
          <span>{ct.label}</span>
        </div>
      ))}
    </div>
  );
}
