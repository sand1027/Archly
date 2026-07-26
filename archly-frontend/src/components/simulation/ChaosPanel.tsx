"use client";

/**
 * ChaosPanel — matches archly.dev layout exactly.
 *
 * Layout:
 *   [Presets] [Chaos]  ← tab row
 *   [Search chaos…]    ← search input
 *   ▶ Start simulation to enable chaos  ← banner when not running
 *
 *   INFRASTRUCTURE FAILURES
 *   [card] [card]
 *   [card] [card]  ...
 *
 *   NETWORK CHAOS
 *   [card] [card] ...
 *
 *   APPLICATION-LEVEL CHAOS
 *   [card] [card] ...
 *
 *   GLOBAL EVENTS
 *   [card] ...
 */

import { useState, useMemo } from "react";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import {
  CHAOS_SCENARIOS,
  CHAOS_GROUP_LABELS,
  getChaosType,
  type ChaosGroup,
  type ChaosScenario,
} from "@/lib/simulation/chaos";
import { CHAOS_PACKS } from "@/lib/simulation/chaos-packs";
import type { ChaosType } from "@/types";

interface ChaosPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** dock = fill parent sidebar; float = floating bottom panel (legacy) */
  layout?: "dock" | "float";
}

// Groups in the order they appear in the screenshot
const GROUP_ORDER: ChaosGroup[] = ["infrastructure", "network", "application", "global"];

export default function ChaosPanel({
  isOpen = true,
  onClose,
  layout = "dock",
}: ChaosPanelProps) {
  const [tab, setTab]       = useState<"presets" | "chaos">("chaos");
  const [search, setSearch] = useState("");

  const isRunning           = useSimulationStore((s) => s.isRunning);
  const activeInjections    = useSimulationStore((s) => s.activeInjections);
  const pendingChaosType    = useSimulationStore((s) => s.pendingChaosType);
  const setPendingChaosType = useSimulationStore((s) => s.setPendingChaosType);
  const clearAllChaos       = useSimulationStore((s) => s.clearAllChaos);

  const filteredScenarios = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CHAOS_SCENARIOS;
    return CHAOS_SCENARIOS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q)
    );
  }, [search]);

  const groupedResults = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      label: CHAOS_GROUP_LABELS[group],
      items: filteredScenarios.filter((s) => s.group === group),
    })).filter((g) => g.items.length > 0);
  }, [filteredScenarios]);

  if (!isOpen) return null;

  const body = (
    <>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
          background: "var(--pd-surface)",
        }}
      >
        {(["presets", "chaos"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: "transparent",
              fontSize: 12,
              fontWeight: tab === t ? 800 : 600,
              color: tab === t ? "var(--pd-brand)" : "var(--pd-text-muted)",
              cursor: "pointer",
              borderBottom: tab === t ? "2px solid var(--pd-brand)" : "2px solid transparent",
              marginBottom: -1,
              textTransform: "capitalize",
            }}
          >
            {t === "presets" ? "Presets" : "Chaos"}
          </button>
        ))}
      </div>

      {tab === "presets" ? (
        <PresetsTab />
      ) : (
        <ChaosTab
          isRunning={isRunning}
          search={search}
          setSearch={setSearch}
          groupedResults={groupedResults}
          activeInjections={activeInjections}
          pendingChaosType={pendingChaosType}
          setPendingChaosType={setPendingChaosType}
          clearAllChaos={clearAllChaos}
          onPicked={() => {
            if (layout === "float") onClose?.();
          }}
        />
      )}
    </>
  );

  if (layout === "dock") {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--pd-sidebar-bg)",
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 185,
          background: "transparent",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "calc(var(--pd-simbar-height) + 10px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 190,
          width: 320,
          maxHeight: "60vh",
          background: "var(--pd-surface)",
          border: "1px solid var(--pd-border)",
          borderRadius: "var(--pd-radius-lg)",
          boxShadow: "var(--pd-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "slide-in-up 180ms var(--pd-ease)",
        }}
      >
        {body}
      </div>
    </>
  );
}

// ─── Presets tab ──────────────────────────────────────────────────────────

function PresetsTab() {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const injectChaos = useSimulationStore((s) => s.injectChaos);
  const clearAllChaos = useSimulationStore((s) => s.clearAllChaos);

  const applyPack = (pack: (typeof CHAOS_PACKS)[number]) => {
    if (!isRunning) return;
    const nodes = useFlowStore.getState().nodes.filter((n) => n.type === "flowNode");
    if (nodes.length === 0) return;
    clearAllChaos();
    pack.injections.forEach((type, i) => {
      const node = nodes[i % nodes.length];
      injectChaos({
        id: `pack-${pack.id}-${i}-${Date.now()}`,
        type,
        nodeId: node.id,
        params: getChaosType(type).defaultParams,
        injectedAt: Date.now(),
      });
    });
  };

  const ARCH_PRESETS = [
    { id: "twitter", name: "Twitter Feed", desc: "Fan-out on write, Redis, Cassandra" },
    { id: "uber", name: "Ride Sharing", desc: "WebSocket, geo-sharding, Kafka" },
    { id: "netflix", name: "Video Streaming", desc: "CDN, HLS/DASH, async transcoding" },
    { id: "url", name: "URL Shortener", desc: "CDN for popular, DB for rare" },
  ];

  return (
    <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: 10 }}>
      <p style={{ fontSize: 11, color: "var(--pd-text-subtle)", marginBottom: 8, fontWeight: 700 }}>
        Chaos scenario packs
      </p>
      <p style={{ fontSize: 11, color: "var(--pd-text-subtle)", marginBottom: 10 }}>
        {isRunning
          ? "Applies multiple chaos types across Flow nodes."
          : "Start simulation first, then run a pack."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {CHAOS_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!isRunning}
            onClick={() => applyPack(p)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              gap: 2, padding: "8px 12px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "var(--pd-bg-subtle)",
              cursor: isRunning ? "pointer" : "not-allowed",
              textAlign: "left",
              opacity: isRunning ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pd-text)" }}>{p.name}</span>
            <span style={{ fontSize: 11, color: "var(--pd-text-subtle)" }}>{p.description}</span>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "var(--pd-text-subtle)", marginBottom: 10, fontWeight: 700 }}>
        Architecture ideas
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ARCH_PRESETS.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              gap: 2, padding: "8px 12px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "var(--pd-bg-subtle)",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pd-text)" }}>{p.name}</span>
            <span style={{ fontSize: 11, color: "var(--pd-text-subtle)" }}>{p.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chaos tab ────────────────────────────────────────────────────────────

interface ChaosTabProps {
  isRunning: boolean;
  search: string;
  setSearch: (s: string) => void;
  groupedResults: { group: ChaosGroup; label: string; items: ChaosScenario[] }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeInjections: any[];
  pendingChaosType: ChaosType | null;
  setPendingChaosType: (t: ChaosType | null) => void;
  clearAllChaos: () => void;
  onPicked: () => void;
}

function ChaosTab({
  isRunning, search, setSearch,
  groupedResults, activeInjections,
  pendingChaosType, setPendingChaosType, clearAllChaos, onPicked,
}: ChaosTabProps) {

  const handleScenarioClick = (scenario: ChaosScenario) => {
    if (!isRunning) return;
    setPendingChaosType(scenario.chaosType);
    onPicked();
  };

  return (
    <>
      {/* Search */}
      <div style={{
        padding: "8px 10px",
        borderBottom: "1px solid var(--pd-border)",
        flexShrink: 0,
        background: "var(--pd-sidebar-bg)",
      }}>
        <div style={{ position: "relative" }}>
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}
            aria-hidden="true" overflow="hidden"
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              color: "var(--pd-text-subtle)", pointerEvents: "none", display: "block",
            }}>
            <path d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search chaos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pd-input"
            style={{ paddingLeft: 26, fontSize: 12 }}
          />
        </div>
      </div>

      {/* Active injections bar */}
      {activeInjections.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 12px",
          background: "color-mix(in srgb, var(--pd-brand) 8%, transparent)",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pd-brand)" }}>
            {activeInjections.length} active injection{activeInjections.length > 1 ? "s" : ""}
          </span>
          <button
            onClick={clearAllChaos}
            style={{
              fontSize: 10, fontWeight: 700, color: "var(--pd-sim-error)",
              background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
              borderRadius: "var(--pd-radius-sm)",
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* "Start simulation" banner */}
      {!isRunning && (
        <div style={{
          margin: "10px", padding: "10px 12px",
          borderRadius: "var(--pd-radius)",
          background: "var(--pd-brand-subtle)",
          border: "1px solid color-mix(in srgb, var(--pd-brand) 30%, transparent)",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>▶</span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--pd-brand-text)",
            lineHeight: 1.4,
          }}>
            Start simulation to enable chaos
          </span>
        </div>
      )}

      {/* Pending state banner */}
      {pendingChaosType && isRunning && (
        <div style={{
          margin: "0 10px 0",
          padding: "8px 12px",
          borderRadius: "var(--pd-radius)",
          background: "color-mix(in srgb, var(--pd-sim-warn) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pd-sim-warn) 40%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pd-sim-warn)" }}>
            Click a node to inject <strong>{pendingChaosType}</strong>
          </span>
          <button
            onClick={() => setPendingChaosType(null)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: "var(--pd-text-subtle)", padding: "0 2px",
            }}
          >✕</button>
        </div>
      )}

      {/* Scrollable scenario list */}
      <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: "6px 10px 12px" }}>
        {groupedResults.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--pd-text-subtle)", fontSize: 12 }}>
            No chaos scenarios found
          </div>
        ) : (
          groupedResults.map(({ group, label, items }) => (
            <div key={group} style={{ marginBottom: 16 }}>
              {/* Group heading */}
              <div style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--pd-text-subtle)",
                marginBottom: 8, paddingLeft: 2,
              }}>
                {label}
              </div>

              {/* 2-column card grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {items.map((scenario) => (
                  <ChaosCard
                    key={scenario.id}
                    scenario={scenario}
                    isRunning={isRunning}
                    onClick={() => handleScenarioClick(scenario)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ─── Chaos card — 2-column style matching archly screenshots ─────────────

function ChaosCard({ scenario, isRunning, onClick }: {
  scenario: ChaosScenario;
  isRunning: boolean;
  onClick: () => void;
}) {
  const disabled = !isRunning;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={scenario.description}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6, padding: "10px 6px",
        borderRadius: "var(--pd-radius)",
        border: "1px solid var(--pd-border)",
        background: "var(--pd-surface)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        textAlign: "center",
        transition: "border-color 120ms, opacity 120ms, box-shadow 120ms",
        minHeight: 76,
        filter: disabled ? "grayscale(60%)" : "none",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.borderColor = "#6b7280";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--pd-shadow-sm)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--pd-border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36,
        borderRadius: "var(--pd-radius)",
        background: "var(--pd-bg-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke="#6b7280"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          overflow="hidden"
          style={{ display: "block", flexShrink: 0 }}
        >
          <path d={scenario.icon} />
        </svg>
      </div>

      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: 500,
        color: "var(--pd-text-muted)",
        lineHeight: 1.3,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {scenario.label}
      </span>
    </button>
  );
}
