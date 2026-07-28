"use client";

import { useEffect, useMemo } from "react";
import { useFlowStore } from "@/store/flow.store";
import { useArchitectureStudioStore } from "@/store/architecture-studio.store";
import { computeBlastRadius } from "@/lib/architecture/blast-radius";
import { PanelShell } from "@/components/architecture/ArchitectureCritiquePanel";

export default function ArchitectureBlastPanel() {
  const overlay = useArchitectureStudioStore((s) => s.overlay);
  const clearOverlay = useArchitectureStudioStore((s) => s.clearOverlay);
  const blastFocusNodeId = useArchitectureStudioStore((s) => s.blastFocusNodeId);
  const setBlastFocus = useArchitectureStudioStore((s) => s.setBlastFocus);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);

  useEffect(() => {
    if (overlay === "blast" && selectedNodeId) setBlastFocus(selectedNodeId);
  }, [overlay, selectedNodeId, setBlastFocus]);

  const result = useMemo(() => {
    if (!blastFocusNodeId) return null;
    return computeBlastRadius(nodes, edges, blastFocusNodeId);
  }, [nodes, edges, blastFocusNodeId]);

  if (overlay !== "blast") return null;

  const focusLabel =
    nodes.find((n) => n.id === blastFocusNodeId)?.data?.label ?? "Select a node";

  return (
    <PanelShell
      title="Blast radius"
      subtitle={blastFocusNodeId ? `Epicenter: ${focusLabel}` : "Click a node on the canvas"}
      onClose={clearOverlay}
    >
      {!result ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--pd-text-muted)" }}>
          Select any node to see what dies downstream and what degrades upstream.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="Down" value={String(result.downIds.length)} color="#dc2626" />
            <Stat label="Degraded" value={String(result.degradedIds.length)} color="#d97706" />
          </div>
          <Legend />
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--pd-text-muted)" }}>
            Downstream of the epicenter goes dark. Upstream callers that depended on it show as degraded.
          </p>
        </div>
      )}
    </PanelShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 10, border: `1px solid color-mix(in srgb, ${color} 30%, var(--pd-border))`, background: `color-mix(in srgb, ${color} 8%, var(--pd-surface))` }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--pd-text)" }}>{value}</div>
    </div>
  );
}

function Legend() {
  const items = [
    { c: "#dc2626", t: "Epicenter / down" },
    { c: "#d97706", t: "Degraded callers" },
    { c: "#94a3b8", t: "Unaffected" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((i) => (
        <div key={i.t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--pd-text-muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.c }} />
          {i.t}
        </div>
      ))}
    </div>
  );
}
