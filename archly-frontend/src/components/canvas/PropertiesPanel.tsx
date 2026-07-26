"use client";

import { useCallback } from "react";
import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { getComponent } from "@/lib/components-registry";
import { CATEGORY_LABELS } from "@/lib/components-registry";
import { CHAOS_TYPES, getChaosType } from "@/lib/simulation/chaos";
import type { NodeConfig } from "@/store/canvas.store";
import type { ChaosType, ComponentCategory } from "@/types";

export default function PropertiesPanel({
  activeTab,
  embedded = false,
}: {
  activeTab: "canvas" | "flow";
  embedded?: boolean;
}) {
  const excalidrawSelectedId = useCanvasStore((s) => s.selectedElementIds[0]);
  const flowSelectedId = useFlowStore((s) => s.selectedNodeId);
  const selectedId = activeTab === "flow" ? (flowSelectedId ?? null) : (excalidrawSelectedId ?? null);

  if (!selectedId) return <EmptyPanel embedded={embedded} />;
  return <SelectedPanel selectedId={selectedId} embedded={embedded} />;
}

function EmptyPanel({ embedded }: { embedded?: boolean }) {
  return (
    <aside style={embedded ? panelFill : aside}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 24,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--pd-bg-muted)",
            border: "1px solid var(--pd-border)",
            display: "grid",
            placeItems: "center",
            color: "var(--pd-text-subtle)",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          ◻
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--pd-text-muted)", textAlign: "center" }}>
          No selection
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--pd-text-subtle)",
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          Click a node to edit CPU, RAM, replicas, and chaos
        </p>
      </div>
    </aside>
  );
}

function SelectedPanel({ selectedId, embedded }: { selectedId: string; embedded?: boolean }) {
  const element = useCanvasStore((s) => s.elements.find((e) => e.id === selectedId));
  const flowNode = useFlowStore((s) => s.nodes.find((n) => n.id === selectedId));
  const nodeConfigs = useCanvasStore((s) => s.nodeConfigs);
  const setNodeConfig = useCanvasStore((s) => s.setNodeConfig);

  const metrics = useSimulationStore((s) => s.metrics);
  const activeInjections = useSimulationStore((s) => s.activeInjections);
  const pendingChaosType = useSimulationStore((s) => s.pendingChaosType);
  const setPendingChaosType = useSimulationStore((s) => s.setPendingChaosType);
  const removeChaos = useSimulationStore((s) => s.removeChaos);
  const isRunning = useSimulationStore((s) => s.isRunning);

  const nodeMetrics = metrics[selectedId] ?? null;
  const nodeInjections = activeInjections.filter((i) => i.nodeId === selectedId);

  const excalidrawCompId = element?.customData?.componentId as string | undefined;
  const flowCompId = (flowNode?.data as { componentId?: string })?.componentId;
  const compId = excalidrawCompId ?? flowCompId;
  const componentDef = compId ? getComponent(compId) : null;

  const excalidrawLabel = element?.customData?.label as string | undefined;
  const flowLabel = (flowNode?.data as { label?: string })?.label;
  const label = excalidrawLabel ?? flowLabel ?? componentDef?.name ?? "Node";

  if (!element && !flowNode) return <EmptyPanel embedded={embedded} />;

  const cfg: NodeConfig = nodeConfigs[selectedId] ?? {
    replicas: 1,
    cpuCores: "default",
    cpuGhz: "default",
    ramGb: "default",
    diskReadIops: "default",
    diskWriteIops: "default",
    networkGbps: "default",
    autoScale: "default",
    rpsCapacity: "default",
    serviceLatencyMs: "default",
    inspection: "default",
    cacheStrategy: "default",
    retryPolicy: "default",
    circuitBreaker: "default",
    timeout: "default",
    label,
  };

  const update = useCallback(
    (patch: Partial<NodeConfig>) => setNodeConfig(selectedId, patch),
    [selectedId, setNodeConfig]
  );

  const catLabel = componentDef
    ? CATEGORY_LABELS[componentDef.category as ComponentCategory] ?? componentDef.category
    : null;

  return (
    <aside style={embedded ? { ...panelFill, overflow: "hidden" } : { ...aside, overflow: "hidden" }}>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
          background: "var(--pd-surface)",
        }}
      >
        {componentDef ? (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: componentDef.color,
              border: `1.5px solid ${componentDef.strokeColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke={componentDef.strokeColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{ display: "block" }}
            >
              <path d={componentDef.icon} />
            </svg>
          </div>
        ) : (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: "var(--pd-bg-muted)",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              flexShrink: 0,
              color: "var(--pd-text-subtle)",
            }}
          >
            ◻
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="pd-input"
            value={cfg.label || label}
            onChange={(e) => update({ label: e.target.value })}
            style={{
              fontWeight: 700,
              fontSize: 13,
              padding: "3px 6px",
              border: "1px solid transparent",
              background: "transparent",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--pd-border)";
              e.currentTarget.style.background = "var(--pd-bg-subtle)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.background = "transparent";
            }}
          />
          {catLabel && (
            <div style={{ fontSize: 10, color: "var(--pd-text-subtle)", paddingLeft: 6, marginTop: 1 }}>
              {catLabel}
            </div>
          )}
        </div>
      </div>

      <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto" }}>
        {isRunning && nodeMetrics && (
          <Section title="Live">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <MChip label="RPS" value={nodeMetrics.rps.toLocaleString()} />
              <MChip
                label="p99"
                value={`${nodeMetrics.latencyP99}ms`}
                warn={nodeMetrics.latencyP99 > 200}
                danger={nodeMetrics.latencyP99 > 1000}
              />
              <MChip
                label="Errors"
                value={`${(nodeMetrics.errorRate * 100).toFixed(1)}%`}
                warn={nodeMetrics.errorRate > 0.05}
                danger={nodeMetrics.errorRate > 0.2}
              />
              <MChip
                label="CPU"
                value={`${nodeMetrics.cpuPercent}%`}
                warn={nodeMetrics.cpuPercent > 70}
                danger={nodeMetrics.cpuPercent > 90}
              />
            </div>
            {nodeMetrics.isBottleneck && (
              <div
                style={{
                  marginTop: 6,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: "color-mix(in srgb, var(--pd-sim-bottleneck) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--pd-sim-bottleneck) 30%, transparent)",
                  color: "var(--pd-sim-bottleneck)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Bottleneck
              </div>
            )}
          </Section>
        )}

        <Section title="Infrastructure">
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={lbl}>Replicas</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--pd-brand)",
                  background: "var(--pd-brand-subtle)",
                  padding: "0 6px",
                  borderRadius: 999,
                }}
              >
                {cfg.replicas}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={64}
              step={1}
              value={cfg.replicas}
              onChange={(e) => update({ replicas: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--pd-brand)", cursor: "pointer" }}
            />
          </div>

          <DenseGrid>
            <Field label="CPU cores">
              <input className="pd-input" value={cfg.cpuCores} placeholder="default" onChange={(e) => update({ cpuCores: e.target.value })} />
            </Field>
            <Field label="CPU GHz">
              <input className="pd-input" value={cfg.cpuGhz} placeholder="default" onChange={(e) => update({ cpuGhz: e.target.value })} />
            </Field>
            <Field label="RAM (GB)">
              <input className="pd-input" value={cfg.ramGb} placeholder="default" onChange={(e) => update({ ramGb: e.target.value })} />
            </Field>
            <Field label="Network">
              <input className="pd-input" value={cfg.networkGbps} placeholder="Gbps" onChange={(e) => update({ networkGbps: e.target.value })} />
            </Field>
            <Field label="Read IOPS">
              <input className="pd-input" value={cfg.diskReadIops} placeholder="default" onChange={(e) => update({ diskReadIops: e.target.value })} />
            </Field>
            <Field label="Write IOPS">
              <input className="pd-input" value={cfg.diskWriteIops} placeholder="default" onChange={(e) => update({ diskWriteIops: e.target.value })} />
            </Field>
          </DenseGrid>

          <Field label="Auto-scale" full>
            <select
              className="pd-select"
              value={cfg.autoScale}
              onChange={(e) => update({ autoScale: e.target.value as NodeConfig["autoScale"] })}
            >
              <option value="default">default</option>
              <option value="disabled">disabled</option>
              <option value="enabled">enabled</option>
              <option value="aggressive">aggressive</option>
            </select>
          </Field>
        </Section>

        <Section title="Capacity">
          <DenseGrid>
            <Field label="RPS / instance">
              <input className="pd-input" value={cfg.rpsCapacity} placeholder="default" onChange={(e) => update({ rpsCapacity: e.target.value })} />
            </Field>
            <Field label="Latency (ms)">
              <input className="pd-input" value={cfg.serviceLatencyMs} placeholder="default" onChange={(e) => update({ serviceLatencyMs: e.target.value })} />
            </Field>
          </DenseGrid>
          <Field label="Inspection" full>
            <select
              className="pd-select"
              value={cfg.inspection}
              onChange={(e) => update({ inspection: e.target.value as NodeConfig["inspection"] })}
            >
              <option value="default">default</option>
              <option value="none">none</option>
              <option value="basic">basic</option>
              <option value="full">full</option>
            </select>
          </Field>
        </Section>

        <Section title="Patterns">
          <Field label="Cache" full>
            <select
              className="pd-select"
              value={cfg.cacheStrategy}
              onChange={(e) => update({ cacheStrategy: e.target.value as NodeConfig["cacheStrategy"] })}
            >
              <option value="default">default</option>
              <option value="none">none</option>
              <option value="cache-aside">cache-aside</option>
              <option value="write-through">write-through</option>
              <option value="write-behind">write-behind</option>
            </select>
          </Field>
          <Field label="Retry" full>
            <select
              className="pd-select"
              value={cfg.retryPolicy}
              onChange={(e) => update({ retryPolicy: e.target.value as NodeConfig["retryPolicy"] })}
            >
              <option value="default">default</option>
              <option value="none">none</option>
              <option value="fixed">fixed</option>
              <option value="exponential">exponential</option>
            </select>
          </Field>
          <DenseGrid>
            <Field label="Circuit breaker">
              <select
                className="pd-select"
                value={cfg.circuitBreaker}
                onChange={(e) => update({ circuitBreaker: e.target.value as NodeConfig["circuitBreaker"] })}
              >
                <option value="default">default</option>
                <option value="none">none</option>
                <option value="enabled">enabled</option>
              </select>
            </Field>
            <Field label="Timeout (ms)">
              <input className="pd-input" value={cfg.timeout} placeholder="default" onChange={(e) => update({ timeout: e.target.value })} />
            </Field>
          </DenseGrid>
        </Section>

        {nodeInjections.length > 0 && (
          <Section title="Active chaos">
            {nodeInjections.map((inj) => {
              const def = getChaosType(inj.type);
              return (
                <div
                  key={inj.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 6px",
                    borderRadius: 6,
                    background: "var(--pd-bg-muted)",
                    marginBottom: 4,
                    border: "1px solid var(--pd-border)",
                  }}
                >
                  <span className={`sim-chaos-pill ${def.cssClass}`}>
                    {def.icon} {def.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChaos(inj.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--pd-text-subtle)",
                      fontSize: 13,
                      padding: "0 2px",
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </Section>
        )}

        <Section title="Inject chaos">
          {pendingChaosType ? (
            <div
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--pd-brand-subtle)",
                border: "1px solid color-mix(in srgb, var(--pd-brand) 40%, transparent)",
                color: "var(--pd-brand)",
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Last: <strong>{pendingChaosType}</strong>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "var(--pd-text-subtle)", margin: "0 0 6px" }}>
              Inject into this node
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {CHAOS_TYPES.map((ct) => (
              <button
                key={ct.type}
                type="button"
                onClick={() => {
                  if (pendingChaosType === ct.type) {
                    setPendingChaosType(null);
                    return;
                  }
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
                  border: "none",
                  cursor: "pointer",
                  justifyContent: "center",
                  padding: "5px 4px",
                  opacity: pendingChaosType && pendingChaosType !== ct.type ? 0.35 : 1,
                  outline: pendingChaosType === ct.type ? "2px solid rgba(255,255,255,0.5)" : "none",
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

const aside: React.CSSProperties = {
  width: "var(--pd-right-panel-width)",
  height: "100%",
  background: "var(--pd-sidebar-bg)",
  borderLeft: "1px solid var(--pd-sidebar-border)",
  display: "flex",
  flexDirection: "column",
  isolation: "isolate",
  position: "relative",
  zIndex: 1,
  flexShrink: 0,
};

const panelFill: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: "100%",
  height: "100%",
  background: "transparent",
  border: "none",
  display: "flex",
  flexDirection: "column",
  isolation: "isolate",
  position: "relative",
  overflow: "auto",
};

const lbl: React.CSSProperties = {
  fontSize: 11,
  color: "var(--pd-text-muted)",
  fontWeight: 500,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--pd-border)" }}>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: "var(--pd-text-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DenseGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        marginBottom: full ? 6 : 0,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <span style={lbl}>{label}</span>
      {children}
    </label>
  );
}

function MChip({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: string;
  warn?: boolean;
  danger?: boolean;
}) {
  const color = danger ? "var(--pd-sim-error)" : warn ? "var(--pd-sim-warn)" : "var(--pd-text)";
  const bg = danger
    ? "color-mix(in srgb, var(--pd-sim-error) 8%, transparent)"
    : warn
      ? "color-mix(in srgb, var(--pd-sim-warn) 8%, transparent)"
      : "var(--pd-bg-muted)";
  return (
    <div
      style={{
        padding: "5px 7px",
        borderRadius: 6,
        background: bg,
        border: `1px solid ${danger || warn ? color : "var(--pd-border)"}`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "var(--pd-text-subtle)",
          marginBottom: 1,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}
