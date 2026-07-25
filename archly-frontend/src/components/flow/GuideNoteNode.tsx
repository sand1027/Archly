"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export interface GuideNoteData {
  title: string;
  body: string;
  roles?: { name: string; role: string; why: string }[];
  [key: string]: unknown;
}

/**
 * Wide sticky note placed by Student Guide labs to explain the architecture.
 */
const GuideNoteNode = memo(({ data, selected }: NodeProps) => {
  const d = data as GuideNoteData;
  return (
    <div
      style={{
        width: 320,
        borderRadius: 12,
        background: "var(--pd-surface)",
        border: selected
          ? "2px solid var(--pd-brand)"
          : "2px solid color-mix(in srgb, #ca8a04 55%, var(--pd-border))",
        boxShadow: "var(--pd-shadow)",
        overflow: "hidden",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          background: "color-mix(in srgb, #ca8a04 18%, var(--pd-surface))",
          borderBottom: "1px solid color-mix(in srgb, #ca8a04 30%, transparent)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 800,
          fontSize: 12,
          color: "var(--pd-text)",
        }}
      >
        <span>📖</span>
        <span>{d.title || "Architecture Notes"}</span>
      </div>
      <div style={{ padding: "10px 12px", fontSize: 11.5, lineHeight: 1.45, color: "var(--pd-text)" }}>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            fontSize: 11.5,
            lineHeight: 1.45,
          }}
        >
          {d.body}
        </pre>
        {d.roles && d.roles.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid var(--pd-border)", paddingTop: 8 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--pd-text-subtle)",
                marginBottom: 6,
              }}
            >
              Node roles
            </div>
            {d.roles.map((r) => (
              <div key={r.name} style={{ marginBottom: 6 }}>
                <strong>{r.name}</strong>
                <span style={{ color: "var(--pd-text-muted)" }}> — {r.role}</span>
                <div style={{ color: "var(--pd-text-muted)", marginTop: 1 }}>{r.why}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

GuideNoteNode.displayName = "GuideNoteNode";
export default GuideNoteNode;
