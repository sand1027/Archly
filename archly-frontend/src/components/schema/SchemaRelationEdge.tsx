"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { SchemaRelationData } from "@/types/schema";

/** Crow’s-foot-ish label for cardinality. */
function cardGlyph(card?: string): string {
  switch (card) {
    case "1:1":
      return "1 —— 1";
    case "1:N":
      return "1 —— ∞";
    case "N:1":
      return "∞ —— 1";
    case "N:M":
      return "∞ —— ∞";
    default:
      return card || "1 —— ∞";
  }
}

export default function SchemaRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  label,
}: EdgeProps) {
  const rel = (data ?? {}) as SchemaRelationData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const card = rel.cardinality || "1:N";
  const name =
    rel.label ||
    (typeof label === "string" ? label : "") ||
    "";
  const text = name ? `${cardGlyph(card)} · ${name}` : cardGlyph(card);
  const stroke = selected
    ? "var(--pd-brand)"
    : "color-mix(in srgb, var(--pd-brand) 55%, var(--pd-border-strong, #888))";
  const markerId = `schema-arrow-${id}`;

  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 12 12"
            refX={10}
            refY={6}
            markerWidth={10}
            markerHeight={10}
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 6 L 0 11 z" fill={stroke} />
          </marker>
        </defs>
      </svg>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke,
          strokeWidth: selected ? 2.5 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            background: "var(--pd-surface)",
            border: `1px solid ${selected ? "var(--pd-brand)" : "var(--pd-border)"}`,
            color: "var(--pd-text)",
            whiteSpace: "nowrap",
            boxShadow: "var(--pd-shadow-sm)",
          }}
          className="nodrag nopan"
        >
          {text}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
