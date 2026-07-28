"use client";

import { useMemo, type CSSProperties } from "react";
import { useFlowStore } from "@/store/flow.store";
import { useStoryStore } from "@/store/story.store";
import {
  hopLatencyMs,
  interviewOneLiner,
  narrateHop,
  type StoryMode,
} from "@/lib/architecture/story-path";

const MODES: { id: StoryMode; label: string }[] = [
  { id: "happy", label: "Happy" },
  { id: "read", label: "Read" },
  { id: "write", label: "Write" },
  { id: "fail", label: "Fail" },
];

/**
 * Bottom-center Story walkthrough controls — narration, latency, branches.
 * Mounted when Flow + design/simulate; only visible while story.active.
 */
export default function ArchitectureStoryPanel({ lifted = false }: { lifted?: boolean }) {
  const active = useStoryStore((s) => s.active);
  const playing = useStoryStore((s) => s.playing);
  const hopIndex = useStoryStore((s) => s.hopIndex);
  const pathNodeIds = useStoryStore((s) => s.pathNodeIds);
  const mode = useStoryStore((s) => s.mode);
  const pendingBranches = useStoryStore((s) => s.pendingBranches);
  const autoAdvance = useStoryStore((s) => s.autoAdvance);
  const play = useStoryStore((s) => s.play);
  const pause = useStoryStore((s) => s.pause);
  const next = useStoryStore((s) => s.next);
  const prev = useStoryStore((s) => s.prev);
  const restart = useStoryStore((s) => s.restart);
  const stop = useStoryStore((s) => s.stop);
  const chooseBranch = useStoryStore((s) => s.chooseBranch);
  const setMode = useStoryStore((s) => s.setMode);
  const setAutoAdvance = useStoryStore((s) => s.setAutoAdvance);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const pathEdgeIds = useStoryStore((s) => s.pathEdgeIds);

  const narration = useMemo(() => {
    if (!active || !pathNodeIds.length) return null;
    const i = hopIndex;
    const node = nodes.find((n) => n.id === pathNodeIds[i]);
    const prevNode = i > 0 ? nodes.find((n) => n.id === pathNodeIds[i - 1]) : undefined;
    const nextNode =
      i < pathNodeIds.length - 1
        ? nodes.find((n) => n.id === pathNodeIds[i + 1])
        : undefined;
    return narrateHop(node, prevNode, nextNode, mode, i, pathNodeIds.length);
  }, [active, hopIndex, pathNodeIds, mode, nodes]);

  const hopContract = useMemo(() => {
    if (!active || hopIndex <= 0) return null;
    const edgeId = pathEdgeIds[hopIndex - 1];
    if (!edgeId) return null;
    const e = edges.find((x) => x.id === edgeId);
    const d = (e?.data ?? {}) as { requestContract?: string; responseContract?: string; decisionWhy?: string };
    if (!d.requestContract?.trim() && !d.responseContract?.trim() && !d.decisionWhy?.trim()) return null;
    return d;
  }, [active, hopIndex, pathEdgeIds, edges]);

  const cumMs = useMemo(() => {
    let sum = 0;
    for (let i = 0; i <= hopIndex && i < pathNodeIds.length; i++) {
      const n = nodes.find((x) => x.id === pathNodeIds[i]);
      sum += hopLatencyMs(n?.data?.componentId);
    }
    return sum;
  }, [hopIndex, pathNodeIds, nodes]);

  const totalMs = useMemo(() => {
    let sum = 0;
    for (const id of pathNodeIds) {
      const n = nodes.find((x) => x.id === id);
      sum += hopLatencyMs(n?.data?.componentId);
    }
    return sum || 1;
  }, [pathNodeIds, nodes]);

  const complete =
    active && pathNodeIds.length > 1 && hopIndex >= pathNodeIds.length - 1;

  if (!active) return null;

  const hops = Math.max(pathNodeIds.length - 1, 0);
  const progress = totalMs > 0 ? Math.min(1, cumMs / totalMs) : 0;
  const oneLiner = complete ? interviewOneLiner(pathNodeIds, nodes) : null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: lifted ? "calc(var(--pd-simbar-height) + 16px)" : 16,
        transform: "translateX(-50%)",
        zIndex: 85,
        width: "min(480px, calc(100% - 48px))",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          borderRadius: 14,
          border: "1px solid var(--pd-border)",
          background: "var(--pd-surface-raised)",
          boxShadow: "var(--pd-shadow)",
          overflow: "hidden",
        }}
      >
        {/* Latency bar */}
        <div
          style={{
            height: 4,
            background: "var(--pd-bg-muted)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              width: `${progress * 100}%`,
              background:
                mode === "fail"
                  ? "#dc2626"
                  : mode === "read"
                    ? "#2563eb"
                    : mode === "write"
                      ? "#d97706"
                      : "var(--pd-brand)",
              transition: "width 280ms ease",
            }}
          />
        </div>

        <div style={{ padding: "12px 14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--pd-text-subtle)",
                  marginBottom: 4,
                }}
              >
                Story · hop {Math.min(hopIndex + 1, pathNodeIds.length)}/{pathNodeIds.length || 1}
                {" · "}
                {cumMs}ms / {totalMs}ms
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--pd-text)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                }}
              >
                {narration?.title ?? "No path found"}
              </div>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--pd-text-muted)",
                }}
              >
                {narration?.body ??
                  (pathNodeIds.length < 2
                    ? "Connect nodes with edges, then set start/end or Play."
                    : "")}
              </p>
              {hopContract && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--pd-bg-muted)",
                    border: "1px solid var(--pd-border)",
                    fontSize: 11,
                    color: "var(--pd-text-muted)",
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {hopContract.decisionWhy?.trim() && (
                    <div style={{ marginBottom: 6, fontFamily: "var(--ui-font, Assistant, sans-serif)", fontWeight: 600 }}>
                      Why: {hopContract.decisionWhy.trim()}
                    </div>
                  )}
                  {hopContract.requestContract?.trim() && (
                    <div>req: {hopContract.requestContract.trim()}</div>
                  )}
                  {hopContract.responseContract?.trim() && (
                    <div>res: {hopContract.responseContract.trim()}</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={stop}
              title="Exit Story"
              style={iconBtn}
            >
              ✕
            </button>
          </div>

          {pendingBranches.length >= 2 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 10,
                background: "color-mix(in srgb, var(--pd-brand) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--pd-brand) 22%, var(--pd-border))",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pd-text)" }}>
                Branch — continue to…
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pendingBranches.map((b) => (
                  <button
                    key={b.edgeId}
                    type="button"
                    onClick={() => chooseBranch(b.edgeId)}
                    style={{
                      ...chipBtn,
                      borderColor: "color-mix(in srgb, var(--pd-brand) 40%, var(--pd-border))",
                      background: "var(--pd-surface)",
                      fontWeight: 700,
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {oneLiner && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                background: "color-mix(in srgb, var(--pd-brand) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--pd-brand) 20%, var(--pd-border))",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--pd-text)",
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pd-brand)", display: "block", marginBottom: 3 }}>
                Sink · {hops} hop{hops === 1 ? "" : "s"} · ~{totalMs}ms
              </span>
              {oneLiner}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                style={{
                  ...chipBtn,
                  background: mode === m.id ? "color-mix(in srgb, var(--pd-brand) 16%, transparent)" : "transparent",
                  borderColor: mode === m.id ? "color-mix(in srgb, var(--pd-brand) 40%, var(--pd-border))" : "var(--pd-border)",
                  color: mode === m.id ? "var(--pd-brand)" : "var(--pd-text-muted)",
                  fontWeight: mode === m.id ? 800 : 600,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={restart} title="Restart" style={ctrlBtn}>
              ↺
            </button>
            <button type="button" onClick={prev} title="Previous hop" style={ctrlBtn} disabled={hopIndex <= 0}>
              ‹
            </button>
            <button
              type="button"
              onClick={() => (playing ? pause() : play())}
              title={playing ? "Pause" : "Play"}
              style={{
                ...ctrlBtn,
                width: 40,
                height: 32,
                background: "var(--pd-brand)",
                borderColor: "var(--pd-brand)",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={next}
              title="Next hop"
              style={ctrlBtn}
              disabled={hopIndex >= pathNodeIds.length - 1 && !pendingBranches.length}
            >
              ›
            </button>
            <label
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--pd-text-muted)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                style={{ accentColor: "var(--pd-brand)" }}
              />
              Auto
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact Story entry FAB — shown when story is inactive */
export function ArchitectureStoryLaunchButton({
  lifted = false,
  onActivate,
}: {
  lifted?: boolean;
  /** Called before activate — e.g. close Guide */
  onActivate?: () => void;
}) {
  const nodes = useFlowStore((s) => s.nodes);
  const active = useStoryStore((s) => s.active);
  const activate = useStoryStore((s) => s.activate);

  if (!nodes.length || active) return null;

  return (
    <button
      type="button"
      onClick={() => {
        onActivate?.();
        activate();
      }}
      title="Walk the request path hop by hop"
      style={{
        position: "absolute",
        left: 12,
        bottom: lifted ? "calc(var(--pd-simbar-height) + 72px)" : 72,
        zIndex: 80,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px 9px 10px",
        borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--pd-brand) 28%, var(--pd-border))",
        background: "var(--pd-surface)",
        boxShadow: "var(--pd-shadow)",
        cursor: "pointer",
        color: "var(--pd-text)",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--pd-brand) 14%, transparent)",
          color: "var(--pd-brand)",
          flexShrink: 0,
        }}
      >
        <StoryGlyph />
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.01em" }}>Story</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pd-brand)" }}>
          Path walkthrough
        </span>
      </span>
    </button>
  );
}

function StoryGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const iconBtn: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
};

const ctrlBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  color: "var(--pd-text)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  display: "grid",
  placeItems: "center",
};

const chipBtn: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  fontSize: 11,
  cursor: "pointer",
  color: "var(--pd-text)",
};
