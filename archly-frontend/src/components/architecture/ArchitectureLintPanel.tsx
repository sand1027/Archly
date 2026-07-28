"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useFlowStore } from "@/store/flow.store";
import { lintArchitecture, type LintIssue } from "@/lib/architecture/architecture-lint";

export default function ArchitectureLintPanel() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const issues = useMemo(
    () => lintArchitecture(nodes, edges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, tick]
  );

  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  if (!nodes.length) return null;

  const status =
    errors > 0 ? "error" : warns > 0 ? "warn" : issues.length > 0 ? "info" : "ok";
  const statusColor =
    status === "error"
      ? "#dc2626"
      : status === "warn"
        ? "#d97706"
        : status === "info"
          ? "#2563eb"
          : "var(--pd-brand)";
  const statusLabel =
    status === "ok"
      ? "All clear"
      : errors > 0
        ? `${errors} error${errors === 1 ? "" : "s"}`
        : warns > 0
          ? `${warns} warning${warns === 1 ? "" : "s"}`
          : `${infos} tip${infos === 1 ? "" : "s"}`;

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 16,
        zIndex: 80,
        width: open ? 356 : "auto",
        maxWidth: "calc(100% - 24px)",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px 9px 10px",
          borderRadius: 12,
          border: `1px solid color-mix(in srgb, ${statusColor} 28%, var(--pd-border))`,
          background: "var(--pd-surface)",
          boxShadow: "var(--pd-shadow)",
          cursor: "pointer",
          color: "var(--pd-text)",
          transition: "border-color 140ms, box-shadow 140ms",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: `color-mix(in srgb, ${statusColor} 14%, transparent)`,
            color: statusColor,
            flexShrink: 0,
          }}
        >
          <LintGlyph />
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.01em" }}>Lint</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
        </span>
        <span
          style={{
            marginLeft: 4,
            fontSize: 11,
            color: "var(--pd-text-subtle)",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 140ms",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            maxHeight: 360,
            display: "flex",
            flexDirection: "column",
            borderRadius: 14,
            border: "1px solid var(--pd-border)",
            background: "var(--pd-surface-raised)",
            boxShadow: "var(--pd-shadow)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "10px 12px",
              borderBottom: "1px solid var(--pd-border)",
              background: "var(--pd-surface)",
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pd-text)" }}>
                Architecture checks
              </div>
              <div style={{ fontSize: 10.5, color: "var(--pd-text-subtle)", marginTop: 1 }}>
                {issues.length === 0
                  ? "No issues found"
                  : `${issues.length} finding${issues.length === 1 ? "" : "s"}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {errors > 0 && <CountPill n={errors} color="#dc2626" />}
              {warns > 0 && <CountPill n={warns} color="#d97706" />}
              {infos > 0 && <CountPill n={infos} color="#2563eb" />}
            </div>
          </div>

          <div className="scrollbar-hide" style={{ padding: 10, overflowY: "auto", flex: 1 }}>
            {issues.length === 0 ? (
              <div
                style={{
                  padding: "18px 12px",
                  textAlign: "center",
                  borderRadius: 10,
                  background: "color-mix(in srgb, var(--pd-brand) 8%, var(--pd-surface))",
                  border: "1px solid color-mix(in srgb, var(--pd-brand) 22%, var(--pd-border))",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pd-text)" }}>
                  Looks solid
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--pd-text-muted)",
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  No structural issues on this diagram.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onFocus={() => {
                      if (issue.nodeIds[0]) setSelectedNodeId(issue.nodeIds[0]);
                    }}
                    onFixed={() => setTick((t) => t + 1)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountPill({ n, color }: { n: number; color: string }) {
  return (
    <span
      style={{
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 800,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {n}
    </span>
  );
}

function LintGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 11l3 3L22 4"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IssueCard({
  issue,
  onFocus,
  onFixed,
}: {
  issue: LintIssue;
  onFocus: () => void;
  onFixed: () => void;
}) {
  const color =
    issue.severity === "error" ? "#dc2626" : issue.severity === "warn" ? "#d97706" : "#2563eb";

  return (
    <div
      style={{
        padding: "10px 11px",
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${color} 22%, var(--pd-border))`,
        background: `color-mix(in srgb, ${color} 6%, var(--pd-surface))`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color,
            padding: "2px 6px",
            borderRadius: 4,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        >
          {issue.severity}
        </span>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--pd-text)",
            letterSpacing: "-0.01em",
          }}
        >
          {issue.title}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pd-text-muted)", lineHeight: 1.45 }}>
        {issue.detail}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={onFocus} style={miniBtn}>
          Focus
        </button>
        {issue.applyFix && issue.fixLabel && (
          <button
            type="button"
            onClick={() => {
              issue.applyFix?.();
              onFixed();
            }}
            style={{
              ...miniBtn,
              fontWeight: 700,
              color: "#fff",
              background: "var(--pd-brand)",
              borderColor: "var(--pd-brand)",
            }}
          >
            {issue.fixLabel}
          </button>
        )}
      </div>
    </div>
  );
}

const miniBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "5px 10px",
  borderRadius: 7,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
};
