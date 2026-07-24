"use client";

import { useSimulationStore } from "@/store/simulation.store";
import { startSimulationLoop, stopSimulationLoop } from "@/lib/simulation/engine";

export default function SimulationBar() {
  const {
    isRunning, trafficMultiplier, speed, bottlenecks,
    start, stop, setTrafficMultiplier, setSpeed, clearAllChaos,
  } = useSimulationStore();
  const activeInjections = useSimulationStore((s) => s.activeInjections);

  const handleToggle = () => {
    if (isRunning) { stop(); stopSimulationLoop(); }
    else { start(); startSimulationLoop(); }
  };

  return (
    <footer style={{
      height: "var(--pd-simbar-height)",
      background: "var(--pd-toolbar-bg)",
      borderTop: "1px solid var(--pd-toolbar-border)",
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px",
      zIndex: 100,
      flexShrink: 0,
      userSelect: "none",
      boxShadow: "0 -1px 0 var(--pd-border)",
      isolation: "isolate",
      position: "relative",
    }}>

      {/* ── Play / Stop ── */}
      <button
        onClick={handleToggle}
        title={isRunning ? "Stop" : "Start simulation"}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 14px", borderRadius: "var(--pd-radius)",
          border: "none",
          background: isRunning
            ? "color-mix(in srgb, var(--pd-sim-error) 12%, transparent)"
            : "var(--pd-brand)",
          color: isRunning ? "var(--pd-sim-error)" : "#fff",
          fontSize: 12, fontWeight: 700,
          cursor: "pointer",
          transition: "all var(--pd-duration) var(--pd-ease)",
          flexShrink: 0,
          boxShadow: isRunning ? "none" : "0 2px 6px rgba(91,94,244,0.3)",
        }}>
        <span style={{ fontSize: 10 }}>{isRunning ? "⏹" : "▶"}</span>
        <span>{isRunning ? "Stop" : "Simulate"}</span>
      </button>

      <Bar />

      {/* ── Traffic ── */}
      <SliderControl
        label="Traffic"
        value={trafficMultiplier}
        min={0.1} max={5} step={0.1}
        display={`${trafficMultiplier.toFixed(1)}×`}
        warn={trafficMultiplier > 3}
        onChange={setTrafficMultiplier}
      />

      {/* ── Speed ── */}
      <SliderControl
        label="Speed"
        value={speed}
        min={0.5} max={3} step={0.25}
        display={`${speed.toFixed(2)}×`}
        onChange={setSpeed}
      />

      <Bar />

      {/* ── Status message ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {bottlenecks.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--pd-sim-bottleneck)", fontWeight: 600 }}>
            ⚠️ {bottlenecks.length} bottleneck{bottlenecks.length > 1 ? "s" : ""} — {bottlenecks[0]?.reason}
          </span>
        ) : isRunning ? (
          <span style={{ fontSize: 12, color: "var(--pd-sim-ok)", fontWeight: 600 }}>
            ✓ All nodes healthy
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--pd-text-subtle)" }}>
            Connect components and run the simulation to get feedback.
          </span>
        )}
      </div>

      {/* ── Clear chaos ── */}
      {activeInjections.length > 0 && (
        <button onClick={clearAllChaos} style={{
          padding: "4px 10px", borderRadius: "var(--pd-radius)",
          border: "1px solid var(--pd-border)",
          background: "var(--pd-bg-subtle)",
          color: "var(--pd-text-muted)", fontSize: 11,
          cursor: "pointer", flexShrink: 0,
          transition: "all var(--pd-duration)",
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--pd-sim-error)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--pd-border)")}
        >
          Clear chaos ({activeInjections.length})
        </button>
      )}
    </footer>
  );
}

function Bar() {
  return (
    <div style={{
      width: 1, height: 18, background: "var(--pd-border)",
      flexShrink: 0, margin: "0 2px",
    }} />
  );
}

function SliderControl({ label, value, min, max, step, display, warn, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; warn?: boolean; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pd-text-muted)", flexShrink: 0 }}>
      <span style={{ fontSize: 11 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 72, accentColor: "var(--pd-brand)", cursor: "pointer" }}
      />
      <span style={{
        minWidth: 34, fontSize: 11, fontWeight: 700, textAlign: "right",
        color: warn ? "var(--pd-sim-warn)" : "var(--pd-text)",
      }}>{display}</span>
    </label>
  );
}
