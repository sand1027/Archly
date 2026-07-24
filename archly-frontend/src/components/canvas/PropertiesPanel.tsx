"use client";

import { useCallback } from "react";
import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { getComponent } from "@/lib/components-registry";
import { CHAOS_TYPES, getChaosType } from "@/lib/simulation/chaos";
import type { NodeConfig } from "@/store/canvas.store";
import type { ChaosType } from "@/types";

export default function PropertiesPanel({ activeTab }: { activeTab: "canvas" | "flow" }) {
  // Excalidraw selection
  const excalidrawSelectedId = useCanvasStore((s) => s.selectedElementIds[0]);
  // Flow canvas selection — independent store, no bridging needed
  const flowSelectedId = useFlowStore((s) => s.selectedNodeId);

  // Only read from the active tab's store
  const selectedId = activeTab === "flow" ? (flowSelectedId ?? null) : (excalidrawSelectedId ?? null);

  if (!selectedId) return <EmptyPanel />;
  return <SelectedPanel selectedId={selectedId} />;
}

function EmptyPanel() {
  return (
    <aside style={aside}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 10, padding: 20,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "var(--pd-radius-lg)",
          background: "var(--pd-bg-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>🔍</div>
        <p style={{ fontSize: 12, color: "var(--pd-text-subtle)", textAlign: "center", lineHeight: 1.5 }}>
          Click a component to configure it
        </p>
      </div>
    </aside>
  );
}

function SelectedPanel({ selectedId }: { selectedId: string }) {
  // Try Excalidraw element first, then fall back to flow node
  const element       = useCanvasStore((s) => s.elements.find((e) => e.id === selectedId));
  const flowNode      = useFlowStore((s) => s.nodes.find((n) => n.id === selectedId));
  const nodeConfigs   = useCanvasStore((s) => s.nodeConfigs);
  const setNodeConfig = useCanvasStore((s) => s.setNodeConfig);

  const metrics             = useSimulationStore((s) => s.metrics);
  const activeInjections    = useSimulationStore((s) => s.activeInjections);
  const pendingChaosType    = useSimulationStore((s) => s.pendingChaosType);
  const setPendingChaosType = useSimulationStore((s) => s.setPendingChaosType);
  const removeChaos         = useSimulationStore((s) => s.removeChaos);
  const isRunning           = useSimulationStore((s) => s.isRunning);

  const nodeMetrics    = metrics[selectedId] ?? null;
  const nodeInjections = activeInjections.filter((i) => i.nodeId === selectedId);

  // Resolve component info from either source
  const excalidrawCompId = element?.customData?.componentId as string | undefined;
  const flowCompId       = (flowNode?.data as { componentId?: string })?.componentId;
  const compId           = excalidrawCompId ?? flowCompId;
  const componentDef     = compId ? getComponent(compId) : null;

  const excalidrawLabel = element?.customData?.label as string | undefined;
  const flowLabel       = (flowNode?.data as { label?: string })?.label;
  const label           = excalidrawLabel ?? flowLabel ?? componentDef?.name ?? "Node";

  // Neither source has this ID — show empty
  if (!element && !flowNode) return <EmptyPanel />;

  const cfg: NodeConfig = nodeConfigs[selectedId] ?? {
    replicas: 1, cpuCores: "default", cpuGhz: "default", ramGb: "default",
    diskReadIops: "default", diskWriteIops: "default", networkGbps: "default",
    autoScale: "default", rpsCapacity: "default", serviceLatencyMs: "default",
    inspection: "default", cacheStrategy: "default", retryPolicy: "default",
    circuitBreaker: "default", timeout: "default", label,
  };

  const update = useCallback(
    (patch: Partial<NodeConfig>) => setNodeConfig(selectedId, patch),
    [selectedId, setNodeConfig]
  );

  return (
    <aside style={{ ...aside, overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px 10px",
        borderBottom: "1px solid var(--pd-border)",
        flexShrink: 0,
        background: "var(--pd-sidebar-bg)",
      }}>
        {componentDef ? (
          <div style={{
            width: 32, height: 32, borderRadius: "var(--pd-radius)",
            background: componentDef.color,
            border: `2px solid ${componentDef.strokeColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, boxShadow: "var(--pd-shadow-sm)",
          }}>
            <svg viewBox="0 0 24 24" width={16} height={16}
              fill="none" stroke={componentDef.strokeColor}
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true" overflow="hidden" style={{ display: "block" }}>
              <path d={componentDef.icon} />
            </svg>
          </div>
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: "var(--pd-radius)",
            background: "var(--pd-bg-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>□</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pd-text)", lineHeight: 1.2 }}>{label}</div>
          {componentDef && (
            <div style={{ fontSize: 10, color: "var(--pd-text-subtle)", marginTop: 1 }}>
              {componentDef.category}
            </div>
          )}
        </div>
      </div>

      <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto" }}>

        {/* ── Live Metrics ── */}
        {isRunning && nodeMetrics && (
          <Section title="Live Metrics">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              <MChip label="RPS"    value={nodeMetrics.rps.toLocaleString()} />
              <MChip label="p99"    value={`${nodeMetrics.latencyP99}ms`}
                warn={nodeMetrics.latencyP99 > 200} danger={nodeMetrics.latencyP99 > 1000} />
              <MChip label="Errors" value={`${(nodeMetrics.errorRate * 100).toFixed(1)}%`}
                warn={nodeMetrics.errorRate > 0.05} danger={nodeMetrics.errorRate > 0.2} />
              <MChip label="CPU"    value={`${nodeMetrics.cpuPercent}%`}
                warn={nodeMetrics.cpuPercent > 70} danger={nodeMetrics.cpuPercent > 90} />
            </div>
            {nodeMetrics.isBottleneck && (
              <div style={{
                marginTop: 8, padding: "6px 10px",
                borderRadius: "var(--pd-radius-sm)",
                background: "color-mix(in srgb, var(--pd-sim-bottleneck) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--pd-sim-bottleneck) 30%, transparent)",
                color: "var(--pd-sim-bottleneck)", fontSize: 11, fontWeight: 700,
              }}>⚠️ BOTTLENECK</div>
            )}
          </Section>
        )}

        {/* ── INFRASTRUCTURE ── */}
        <Section title="Infrastructure">
          {/* Replicas */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={lbl}>Replicas</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "var(--pd-brand)",
                background: "var(--pd-brand-subtle)",
                padding: "1px 7px", borderRadius: "var(--pd-radius-full)",
              }}>{cfg.replicas}</span>
            </div>
            <input type="range" min={1} max={64} step={1} value={cfg.replicas}
              onChange={(e) => update({ replicas: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--pd-brand)", cursor: "pointer" }} />
          </div>

          <Row label="CPU cores">
            <input className="pd-input" value={cfg.cpuCores} placeholder="default"
              onChange={(e) => update({ cpuCores: e.target.value })} />
          </Row>
          <Row label="CPU GHz">
            <input className="pd-input" value={cfg.cpuGhz} placeholder="default"
              onChange={(e) => update({ cpuGhz: e.target.value })} />
          </Row>
          <Row label="RAM (GB)">
            <input className="pd-input" value={cfg.ramGb} placeholder="default"
              onChange={(e) => update({ ramGb: e.target.value })} />
          </Row>
          <Row label="Disk read IOPS">
            <input className="pd-input" value={cfg.diskReadIops} placeholder="default"
              onChange={(e) => update({ diskReadIops: e.target.value })} />
          </Row>
          <Row label="Disk write IOPS">
            <input className="pd-input" value={cfg.diskWriteIops} placeholder="default"
              onChange={(e) => update({ diskWriteIops: e.target.value })} />
          </Row>
          <Row label="Network (Gbps)">
            <input className="pd-input" value={cfg.networkGbps} placeholder="default"
              onChange={(e) => update({ networkGbps: e.target.value })} />
          </Row>
          <Row label="Auto-scale">
            <select className="pd-select" value={cfg.autoScale}
              onChange={(e) => update({ autoScale: e.target.value as NodeConfig["autoScale"] })}>
              <option value="default">default</option>
              <option value="disabled">disabled</option>
              <option value="enabled">enabled</option>
              <option value="aggressive">aggressive</option>
            </select>
          </Row>
        </Section>

        {/* ── CAPACITY ── */}
        <Section title="Capacity">
          <Row label="RPS capacity">
            <div>
              <input className="pd-input" value={cfg.rpsCapacity} placeholder="default"
                onChange={(e) => update({ rpsCapacity: e.target.value })} />
              <div style={subLbl}>per instance</div>
            </div>
          </Row>
          <Row label="Service latency">
            <div>
              <input className="pd-input" value={cfg.serviceLatencyMs} placeholder="default"
                onChange={(e) => update({ serviceLatencyMs: e.target.value })} />
              <div style={subLbl}>ms</div>
            </div>
          </Row>
          <Row label="Inspection">
            <select className="pd-select" value={cfg.inspection}
              onChange={(e) => update({ inspection: e.target.value as NodeConfig["inspection"] })}>
              <option value="default">— default —</option>
              <option value="none">none</option>
              <option value="basic">basic</option>
              <option value="full">full</option>
            </select>
          </Row>
        </Section>

        {/* ── PATTERNS ── */}
        <Section title="Patterns">
          <Row label="Cache strategy">
            <select className="pd-select" value={cfg.cacheStrategy}
              onChange={(e) => update({ cacheStrategy: e.target.value as NodeConfig["cacheStrategy"] })}>
              <option value="default">default</option>
              <option value="none">none</option>
              <option value="cache-aside">cache-aside</option>
              <option value="write-through">write-through</option>
              <option value="write-behind">write-behind</option>
            </select>
          </Row>
          <Row label="Retry policy">
            <select className="pd-select" value={cfg.retryPolicy}
              onChange={(e) => update({ retryPolicy: e.target.value as NodeConfig["retryPolicy"] })}>
              <option value="default">default</option>
              <option value="none">none</option>
              <option value="fixed">fixed</option>
              <option value="exponential">exponential</option>
            </select>
          </Row>
          <Row label="Circuit breaker">
            <select className="pd-select" value={cfg.circuitBreaker}
              onChange={(e) => update({ circuitBreaker: e.target.value as NodeConfig["circuitBreaker"] })}>
              <option value="default">default</option>
              <option value="none">none</option>
              <option value="enabled">enabled</option>
            </select>
          </Row>
          <Row label="Timeout (ms)">
            <input className="pd-input" value={cfg.timeout} placeholder="default"
              onChange={(e) => update({ timeout: e.target.value })} />
          </Row>
        </Section>

        {/* ── Active chaos ── */}
        {nodeInjections.length > 0 && (
          <Section title="Active Chaos">
            {nodeInjections.map((inj) => {
              const def = getChaosType(inj.type);
              return (
                <div key={inj.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 6px", borderRadius: "var(--pd-radius-sm)",
                  background: "var(--pd-bg-muted)", marginBottom: 4,
                  border: "1px solid var(--pd-border)",
                }}>
                  <span className={`sim-chaos-pill ${def.cssClass}`}>{def.icon} {def.label}</span>
                  <button onClick={() => removeChaos(inj.id)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--pd-text-subtle)", fontSize: 14, padding: "0 2px",
                    borderRadius: "var(--pd-radius-sm)",
                    transition: "color var(--pd-duration)",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--pd-sim-error)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--pd-text-subtle)")}
                    title="Remove injection"
                  >✕</button>
                </div>
              );
            })}
          </Section>
        )}

        {/* ── Inject Chaos ── */}
        <Section title="Inject Chaos">
          {pendingChaosType ? (
            <div style={{
              padding: "7px 10px", borderRadius: "var(--pd-radius-sm)",
              background: "var(--pd-brand-subtle)",
              border: "1px solid color-mix(in srgb, var(--pd-brand) 40%, transparent)",
              color: "var(--pd-brand)", fontSize: 11, fontWeight: 600, marginBottom: 8,
            }}>
              Last injected: <strong>{pendingChaosType}</strong>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "var(--pd-text-subtle)", marginBottom: 8 }}>
              Click a type to inject into this node:
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {CHAOS_TYPES.map((ct) => (
              <button
                key={ct.type}
                onClick={() => {
                  if (pendingChaosType === ct.type) { setPendingChaosType(null); return; }
                  // Inject directly into the selected node — works for both Excalidraw and Flow
                  useSimulationStore.getState().injectChaos({
                    id: `chaos-${Date.now()}`,
                    type: ct.type as ChaosType,
                    nodeId: selectedId,
                    params: ct.defaultParams,
                    injectedAt: Date.now(),
                  });
                }}
                className={`sim-chaos-pill ${ct.cssClass}`}
                style={{
                  border: "none", cursor: "pointer",
                  justifyContent: "center", padding: "6px 4px",
                  opacity: pendingChaosType && pendingChaosType !== ct.type ? 0.35 : 1,
                  transform: pendingChaosType === ct.type ? "scale(1.04)" : "scale(1)",
                  outline: pendingChaosType === ct.type ? "2px solid rgba(255,255,255,0.6)" : "none",
                  outlineOffset: 1,
                }}
                title={ct.description}
              >
                {ct.icon} {ct.label}
              </button>
            ))}
          </div>
        </Section>

      </div>
    </aside>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const aside: React.CSSProperties = {
  width: "var(--pd-right-panel-width)",
  height: "100%",
  background: "var(--pd-sidebar-bg)",
  borderLeft: "1px solid var(--pd-sidebar-border)",
  display: "flex", flexDirection: "column",
  // isolation prevents Excalidraw CSS from bleeding into this panel
  isolation: "isolate",
  position: "relative",
  zIndex: 1,
  flexShrink: 0,
};

const lbl: React.CSSProperties = {
  fontSize: 12, color: "var(--pd-text-muted)", flexShrink: 0,
};

const subLbl: React.CSSProperties = {
  fontSize: 10, color: "var(--pd-text-subtle)", marginTop: 2,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid var(--pd-border)" }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, color: "var(--pd-text-subtle)",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          width: 3, height: 10, borderRadius: 2,
          background: "var(--pd-brand)", display: "inline-block",
        }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      marginBottom: 7,
    }}>
      <span style={{ ...lbl, paddingTop: 5, minWidth: 96, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function MChip({ label, value, warn, danger }: {
  label: string; value: string; warn?: boolean; danger?: boolean;
}) {
  const color = danger ? "var(--pd-sim-error)" : warn ? "var(--pd-sim-warn)" : "var(--pd-text)";
  const bg    = danger ? "color-mix(in srgb, var(--pd-sim-error) 8%, transparent)"
              : warn   ? "color-mix(in srgb, var(--pd-sim-warn) 8%, transparent)"
              :          "var(--pd-bg-muted)";
  return (
    <div style={{
      padding: "6px 8px", borderRadius: "var(--pd-radius-sm)",
      background: bg,
      border: `1px solid ${danger || warn ? color : "var(--pd-border)"}`,
      opacity: 0.9,
    }}>
      <div style={{ fontSize: 9, color: "var(--pd-text-subtle)", marginBottom: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}
