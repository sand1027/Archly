"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useFlowStore } from "@/store/flow.store";
import { useCanvasStore } from "@/store/canvas.store";
import {
  useArchitectureStudioStore,
  type BudgetTier,
} from "@/store/architecture-studio.store";
import { lintConstraints } from "@/lib/architecture/constraint-lint";
import { estimateGraphCost } from "@/lib/architecture/cost-estimates";
import { PanelShell } from "@/components/architecture/ArchitectureCritiquePanel";

export default function ArchitectureConstraintsPanel() {
  const overlay = useArchitectureStudioStore((s) => s.overlay);
  const clearOverlay = useArchitectureStudioStore((s) => s.clearOverlay);
  const constraints = useArchitectureStudioStore((s) => s.constraints);
  const setConstraints = useArchitectureStudioStore((s) => s.setConstraints);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const getNodeConfig = useCanvasStore((s) => s.getNodeConfig);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);

  const issues = useMemo(
    () => lintConstraints(nodes, edges, constraints, (id) => getNodeConfig(id)),
    [nodes, edges, constraints, getNodeConfig]
  );

  if (overlay !== "constraints") return null;

  return (
    <PanelShell title="Constraints" subtitle="Design under pressure" onClose={clearOverlay}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Toggle
          label="Multi-region"
          checked={constraints.multiRegion}
          onChange={(v) => setConstraints({ multiRegion: v })}
        />
        <Toggle
          label="GDPR / residency"
          checked={constraints.gdpr}
          onChange={(v) => setConstraints({ gdpr: v })}
        />
        <Toggle
          label="p99 under 200ms"
          checked={constraints.p99Under200}
          onChange={(v) => setConstraints({ p99Under200: v })}
        />
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--pd-text-muted)" }}>
          Budget tier
          <select
            value={constraints.budgetUnder}
            onChange={(e) => setConstraints({ budgetUnder: e.target.value as BudgetTier })}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--pd-border)",
              background: "var(--pd-surface)",
              color: "var(--pd-text)",
              fontSize: 12,
            }}
          >
            <option value="none">None</option>
            <option value="low">Low (~$200/mo)</option>
            <option value="mid">Mid (~$1.5k/mo)</option>
            <option value="high">High (~$8k/mo)</option>
          </select>
        </label>

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pd-text-subtle)", marginTop: 4 }}>
          Issues · {issues.length}
        </div>
        {!issues.length ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--pd-text-muted)" }}>
            {constraints.multiRegion || constraints.gdpr || constraints.p99Under200 || constraints.budgetUnder !== "none"
              ? "Constraints satisfied (heuristics)."
              : "Flip a constraint to lint against it."}
          </p>
        ) : (
          issues.map((iss) => (
            <div
              key={iss.id}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--pd-border)",
                background: "var(--pd-surface)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800 }}>{iss.title}</div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--pd-text-muted)", lineHeight: 1.4 }}>{iss.detail}</p>
              {iss.nodeIds[0] && (
                <button type="button" onClick={() => setSelectedNodeId(iss.nodeIds[0])} style={{ marginTop: 6, border: "none", background: "transparent", color: "var(--pd-brand)", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                  Focus
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </PanelShell>
  );
}

export function ArchitectureCostStrip() {
  const overlay = useArchitectureStudioStore((s) => s.overlay);
  const clearOverlay = useArchitectureStudioStore((s) => s.clearOverlay);
  const nodes = useFlowStore((s) => s.nodes);
  const getNodeConfig = useCanvasStore((s) => s.getNodeConfig);

  const totals = useMemo(
    () => estimateGraphCost(nodes, (id) => getNodeConfig(id)),
    [nodes, getNodeConfig]
  );

  if (overlay !== "cost") return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 85,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid var(--pd-border)",
        background: "var(--pd-surface-raised)",
        boxShadow: "var(--pd-shadow)",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
    >
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pd-text-subtle)" }}>
          Cost ghost
        </div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          ~${totals.monthlyUsd}/mo · peak hint {totals.totalRpsHint.toLocaleString()} RPS
        </div>
      </div>
      <button
        type="button"
        onClick={clearOverlay}
        style={{ marginLeft: 8, border: "1px solid var(--pd-border)", background: "var(--pd-surface)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
      >
        Hide
      </button>
    </div>
  );
}

export function ArchitectureErasPanel() {
  const overlay = useArchitectureStudioStore((s) => s.overlay);
  const clearOverlay = useArchitectureStudioStore((s) => s.clearOverlay);
  const eras = useArchitectureStudioStore((s) => s.eras);
  const activeEraId = useArchitectureStudioStore((s) => s.activeEraId);
  const snapshotEra = useArchitectureStudioStore((s) => s.snapshotEra);
  const switchEra = useArchitectureStudioStore((s) => s.switchEra);
  const deleteEra = useArchitectureStudioStore((s) => s.deleteEra);
  const eraDiffFromId = useArchitectureStudioStore((s) => s.eraDiffFromId);
  const eraDiffToId = useArchitectureStudioStore((s) => s.eraDiffToId);
  const setEraDiff = useArchitectureStudioStore((s) => s.setEraDiff);
  const [label, setLabel] = useState("MVP");

  if (overlay !== "eras") return null;

  return (
    <PanelShell title="Time travel" subtitle="Snapshot eras of this design" onClose={clearOverlay}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Era label"
          style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--pd-border)", background: "var(--pd-surface)", fontSize: 12 }}
        />
        <button
          type="button"
          onClick={() => {
            snapshotEra(label);
            setLabel(["MVP", "Scale", "Multi-tenant"][eras.length % 3] ?? "Era");
          }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "var(--pd-brand)", color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer" }}
        >
          Snapshot
        </button>
      </div>
      {!eras.length ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--pd-text-muted)" }}>
          Snapshot MVP, then evolve the graph and snapshot Scale — diff highlights what changed.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {eras.map((e) => (
            <li key={e.id} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--pd-border)", background: activeEraId === e.id ? "color-mix(in srgb, var(--pd-brand) 10%, var(--pd-surface))" : "var(--pd-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => switchEra(e.id)} style={{ border: "none", background: "transparent", fontWeight: 800, fontSize: 12, cursor: "pointer", color: "var(--pd-text)", textAlign: "left" }}>
                  {e.label}
                  <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--pd-text-subtle)" }}>
                    {e.nodes.length} nodes · {new Date(e.createdAt).toLocaleString()}
                  </span>
                </button>
                <button type="button" onClick={() => deleteEra(e.id)} style={{ border: "none", background: "transparent", color: "var(--pd-text-subtle)", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {eras.length >= 2 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pd-text-subtle)" }}>Diff highlight</div>
          <select value={eraDiffFromId ?? ""} onChange={(e) => setEraDiff(e.target.value || null, eraDiffToId)} style={selectStyle}>
            <option value="">From era…</option>
            {eras.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          <select value={eraDiffToId ?? ""} onChange={(e) => setEraDiff(eraDiffFromId, e.target.value || null)} style={selectStyle}>
            <option value="">To era…</option>
            {eras.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
      )}
    </PanelShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--pd-text)", cursor: "pointer" }}>
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--pd-brand)" }} />
    </label>
  );
}

const selectStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  fontSize: 12,
};
