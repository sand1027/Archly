"use client";

import { useFlowStore } from "@/store/flow.store";
import { useSimulationStore } from "@/store/simulation.store";
import { CHAOS_TYPES } from "@/lib/simulation/chaos";
import type { ChaosType } from "@/types";

interface Props {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export default function FlowContextMenu({ nodeId, x, y, onClose }: Props) {
  const removeNode = useFlowStore((s) => s.removeNode);
  const isRunning  = useSimulationStore((s) => s.isRunning);
  const injectChaos = useSimulationStore((s) => s.injectChaos);
  const removeChaos = useSimulationStore((s) => s.removeChaos);
  const activeInjections = useSimulationStore((s) => s.activeInjections);

  const nodeInjections = activeInjections.filter((i) => i.nodeId === nodeId);

  const handleInject = (type: ChaosType) => {
    injectChaos({
      id: `chaos-${Date.now()}`,
      type,
      nodeId,
      params: CHAOS_TYPES.find((c) => c.type === type)?.defaultParams ?? {},
      injectedAt: Date.now(),
    });
    onClose();
  };

  const handleDelete = () => {
    removeNode(nodeId);
    onClose();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: x, top: y,
        zIndex: 200,
        background: "var(--pd-surface)",
        border: "1px solid var(--pd-border)",
        borderRadius: "var(--pd-radius-lg)",
        boxShadow: "var(--pd-shadow-lg)",
        minWidth: 180,
        overflow: "hidden",
        animation: "slide-in-up 150ms var(--pd-ease)",
      }}
    >
      {/* Section: Actions */}
      <div style={{ padding: "4px 0" }}>
        <MenuItem
          icon="✕"
          label="Delete node"
          onClick={handleDelete}
          danger
        />
      </div>

      {/* Section: Chaos */}
      {isRunning && (
        <>
          <div style={{
            padding: "4px 12px 2px",
            fontSize: 9, fontWeight: 700, color: "var(--pd-text-subtle)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            borderTop: "1px solid var(--pd-border)",
          }}>
            Inject Chaos
          </div>
          <div style={{ padding: "2px 0 4px" }}>
            {CHAOS_TYPES.map((ct) => (
              <MenuItem
                key={ct.type}
                icon={ct.icon}
                label={ct.label}
                onClick={() => handleInject(ct.type as ChaosType)}
              />
            ))}
          </div>
        </>
      )}

      {/* Section: Remove active chaos */}
      {nodeInjections.length > 0 && (
        <>
          <div style={{
            padding: "4px 12px 2px",
            fontSize: 9, fontWeight: 700, color: "var(--pd-text-subtle)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            borderTop: "1px solid var(--pd-border)",
          }}>
            Active ({nodeInjections.length})
          </div>
          <div style={{ padding: "2px 0 4px" }}>
            {nodeInjections.map((inj) => (
              <MenuItem
                key={inj.id}
                icon="✕"
                label={`Remove ${inj.type}`}
                onClick={() => { removeChaos(inj.id); onClose(); }}
                danger
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: {
  icon: string; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "6px 12px",
        border: "none", background: "transparent",
        color: danger ? "var(--pd-sim-error)" : "var(--pd-text)",
        fontSize: 12, fontWeight: 500, cursor: "pointer",
        textAlign: "left",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--pd-bg-muted)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
