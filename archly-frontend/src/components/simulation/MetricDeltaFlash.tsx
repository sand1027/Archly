"use client";

import { useEffect, useRef, useState } from "react";
import { getChaosType } from "@/lib/simulation/chaos";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { toast } from "@/store/toast.store";
import type { ChaosInjection, NodeMetrics } from "@/types";

interface Flash {
  id: string;
  nodeLabel: string;
  chaosLabel: string;
  color: string;
  deltas: string[];
}

/**
 * Watches new chaos injections and flashes metric deltas + toasts.
 */
export default function MetricDeltaFlash() {
  const injections = useSimulationStore((s) => s.activeInjections);
  const metrics = useSimulationStore((s) => s.metrics);
  const prevInjRef = useRef<string[]>([]);
  const metricsBeforeRef = useRef<Record<string, NodeMetrics>>({});
  const [flashes, setFlashes] = useState<Flash[]>([]);

  // Snapshot metrics continuously so we can diff when chaos lands
  useEffect(() => {
    metricsBeforeRef.current = { ...metrics };
  }, [metrics]);

  useEffect(() => {
    const prev = new Set(prevInjRef.current);
    const newest = injections.filter((i) => !prev.has(i.id));
    prevInjRef.current = injections.map((i) => i.id);
    if (newest.length === 0) return;

    for (const inj of newest) {
      showFlash(inj, metricsBeforeRef.current[inj.nodeId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injections]);

  function showFlash(inj: ChaosInjection, before: NodeMetrics | undefined) {
    const def = getChaosType(inj.type);
    const node = useFlowStore.getState().nodes.find((n) => n.id === inj.nodeId);
    const nodeLabel =
      (node?.data as { label?: string } | undefined)?.label ?? inj.nodeId.slice(0, 8);

    // After a short tick, metrics will update — poll once
    window.setTimeout(() => {
      const after = useSimulationStore.getState().metrics[inj.nodeId];
      const deltas: string[] = [];
      if (before && after) {
        const dLat = Math.round(after.latencyP99 - before.latencyP99);
        const dErr = Math.round((after.errorRate - before.errorRate) * 1000) / 10;
        const dRps = Math.round(after.rps - before.rps);
        if (dLat !== 0) deltas.push(`p99 ${dLat > 0 ? "+" : ""}${dLat}ms`);
        if (dErr !== 0) deltas.push(`err ${dErr > 0 ? "+" : ""}${dErr}%`);
        if (dRps !== 0) deltas.push(`rps ${dRps > 0 ? "+" : ""}${dRps}`);
      }
      if (deltas.length === 0) {
        if (inj.type === "crash") deltas.push("rps → 0 · err 100%");
        else if (inj.type === "slow") deltas.push(`+${inj.params.latencyMs ?? 500}ms latency`);
        else if (inj.type === "surge") deltas.push(`×${inj.params.surgeMultiplier ?? 10} traffic`);
        else deltas.push(def.description.slice(0, 42));
      }

      const flash: Flash = {
        id: inj.id,
        nodeLabel,
        chaosLabel: def.label,
        color: def.color,
        deltas,
      };
      setFlashes((f) => [...f, flash]);
      toast(
        `${def.icon} ${def.label} on ${nodeLabel}${deltas[0] ? ` · ${deltas[0]}` : ""}`,
        inj.type === "crash" ? "error" : "warn",
        3200
      );
      window.setTimeout(() => {
        setFlashes((f) => f.filter((x) => x.id !== flash.id));
      }, 3400);
    }, 400);
  }

  if (flashes.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 52,
        right: 12,
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 280,
        pointerEvents: "none",
      }}
    >
      {flashes.map((f) => (
        <div
          key={f.id}
          style={{
            padding: "10px 12px",
            borderRadius: "var(--pd-radius-lg)",
            background: "var(--pd-surface)",
            border: `1px solid ${f.color}`,
            boxShadow: `0 0 16px color-mix(in srgb, ${f.color} 35%, transparent)`,
            animation: "slide-in-up 180ms var(--pd-ease)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: f.color, marginBottom: 4 }}>
            {f.chaosLabel} · {f.nodeLabel}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pd-text)" }}>
            {f.deltas.join("  ·  ")}
          </div>
        </div>
      ))}
    </div>
  );
}
