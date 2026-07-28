"use client";

import { useMemo } from "react";
import { useFlowStore } from "@/store/flow.store";
import { useArchitectureStudioStore } from "@/store/architecture-studio.store";
import { critiqueArchitecture } from "@/lib/architecture/architecture-critique";

export default function ArchitectureCritiquePanel() {
  const overlay = useArchitectureStudioStore((s) => s.overlay);
  const clearOverlay = useArchitectureStudioStore((s) => s.clearOverlay);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);

  const cards = useMemo(() => critiqueArchitecture(nodes, edges), [nodes, edges]);

  if (overlay !== "critique") return null;

  return (
    <PanelShell title="Staff critique" onClose={clearOverlay} subtitle={`${cards.length} challenges`}>
      {!cards.length ? (
        <p style={empty}>Clean enough — no major challenges. Add edges into state without a “why” if you want nits.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {cards.map((c) => (
            <li
              key={c.id}
              style={{
                padding: "10px 11px",
                borderRadius: 10,
                border: `1px solid ${sevBorder(c.severity)}`,
                background: sevBg(c.severity),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: sevColor(c.severity) }}>
                  {c.severity}
                </span>
                {c.nodeIds[0] && (
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(c.nodeIds[0])}
                    style={linkBtn}
                  >
                    Focus
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pd-text)", marginBottom: 4 }}>{c.title}</div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--pd-text-muted)" }}>{c.voice}</p>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function PanelShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 90,
        width: 340,
        maxHeight: "min(520px, calc(100% - 24px))",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: "1px solid var(--pd-border)",
        background: "var(--pd-surface-raised)",
        boxShadow: "var(--pd-shadow)",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--pd-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "var(--pd-text-subtle)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button type="button" onClick={onClose} style={{ border: "1px solid var(--pd-border)", background: "var(--pd-surface)", borderRadius: 8, width: 28, height: 28, cursor: "pointer" }}>✕</button>
      </div>
      <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: 12 }}>{children}</div>
    </div>
  );
}

const empty = { margin: 0, fontSize: 12, color: "var(--pd-text-muted)", lineHeight: 1.45 };
const linkBtn = { border: "none", background: "transparent", color: "var(--pd-brand)", fontWeight: 700, fontSize: 11, cursor: "pointer" };

function sevColor(s: string) {
  return s === "block" ? "#dc2626" : s === "challenge" ? "#d97706" : "#2563eb";
}
function sevBorder(s: string) {
  return `color-mix(in srgb, ${sevColor(s)} 35%, var(--pd-border))`;
}
function sevBg(s: string) {
  return `color-mix(in srgb, ${sevColor(s)} 8%, var(--pd-surface))`;
}

export { PanelShell };
