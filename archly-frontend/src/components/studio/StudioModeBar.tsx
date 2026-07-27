"use client";

export type StudioMode = "design" | "simulate" | "export" | "schema";

const MODES: { id: StudioMode; label: string; hint: string }[] = [
  { id: "design", label: "Design", hint: "Build architecture (Alt+D)" },
  { id: "schema", label: "Schema", hint: "Database ERD — tables & relationships" },
  { id: "simulate", label: "Simulate", hint: "Traffic, metrics & chaos" },
  { id: "export", label: "Export", hint: "Mermaid, PNG, SQL, infra code (Alt+E)" },
];

interface Props {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
  canvasTab: "flow" | "canvas";
  onCanvasTabChange: (tab: "flow" | "canvas") => void;
  onClear: () => void;
  sessionTitle?: string | null;
}

export default function StudioModeBar({
  mode,
  onChange,
  canvasTab,
  onCanvasTabChange,
  onClear,
  sessionTitle,
}: Props) {
  const showCanvasTabs = mode !== "schema";

  return (
    <div
      className="studio-mode-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        height: 40,
        flexShrink: 0,
        background: "var(--pd-surface)",
        borderBottom: "1px solid var(--pd-border)",
      }}
    >
      <div
        role="tablist"
        aria-label="Studio mode"
        style={{
          display: "inline-flex",
          padding: 2,
          gap: 1,
          borderRadius: 8,
          background: "var(--pd-bg-muted)",
          border: "1px solid var(--pd-border)",
        }}
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={m.hint}
              onClick={() => onChange(m.id)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: active ? "var(--pd-surface)" : "transparent",
                color: active ? "var(--pd-text)" : "var(--pd-text-muted)",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                boxShadow: active ? "var(--pd-shadow-sm)" : "none",
                transition: "background 120ms, color 120ms, box-shadow 120ms",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {showCanvasTabs && (
        <>
          <Divider />
          <div
            role="tablist"
            aria-label="Canvas type"
            style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
          >
            <CanvasTab
              label="Flow"
              title="Node-edge diagram with live simulation (Alt+2)"
              active={canvasTab === "flow"}
              onClick={() => onCanvasTabChange("flow")}
            />
            <CanvasTab
              label="Freehand"
              title="Excalidraw sketch canvas (Alt+1)"
              active={canvasTab === "canvas"}
              onClick={() => onCanvasTabChange("canvas")}
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onClear}
        title={
          mode === "schema"
            ? "Clear schema"
            : canvasTab === "flow"
              ? "Clear Flow diagram"
              : "Clear Freehand canvas"
        }
        style={{
          padding: "4px 9px",
          borderRadius: 6,
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--pd-text-subtle)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#dc2626";
          e.currentTarget.style.borderColor = "color-mix(in srgb, #dc2626 35%, transparent)";
          e.currentTarget.style.background = "color-mix(in srgb, #dc2626 8%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--pd-text-subtle)";
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.background = "transparent";
        }}
      >
        Clear
      </button>

      <div style={{ flex: 1, minWidth: 0 }} />

      {mode === "schema" && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pd-text-subtle)" }}>
          Database ERD
        </span>
      )}

      {sessionTitle && (
        <span
          title={sessionTitle}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--pd-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 220,
          }}
        >
          {sessionTitle}
        </span>
      )}
    </div>
  );
}

function CanvasTab({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        border: "none",
        background: active
          ? "color-mix(in srgb, var(--pd-brand) 12%, transparent)"
          : "transparent",
        color: active ? "var(--pd-brand)" : "var(--pd-text-muted)",
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "background 120ms, color 120ms",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = "var(--pd-text)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = "var(--pd-text-muted)";
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: "var(--pd-border)",
        flexShrink: 0,
      }}
    />
  );
}
