"use client";

import { useToastStore, type ToastKind } from "@/store/toast.store";

const KIND_STYLE: Record<ToastKind, { bg: string; border: string; color: string }> = {
  info: {
    bg: "var(--pd-surface-raised)",
    border: "var(--pd-border)",
    color: "var(--pd-text)",
  },
  success: {
    bg: "color-mix(in srgb, var(--pd-brand) 12%, var(--pd-surface))",
    border: "color-mix(in srgb, var(--pd-brand) 35%, transparent)",
    color: "var(--pd-brand-text, var(--pd-brand))",
  },
  warn: {
    bg: "color-mix(in srgb, var(--pd-sim-warn) 12%, var(--pd-surface))",
    border: "color-mix(in srgb, var(--pd-sim-warn) 40%, transparent)",
    color: "var(--pd-sim-warn)",
  },
  error: {
    bg: "color-mix(in srgb, var(--pd-sim-error) 12%, var(--pd-surface))",
    border: "color-mix(in srgb, var(--pd-sim-error) 40%, transparent)",
    color: "var(--pd-sim-error)",
  },
};

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  if (items.length === 0) return null;

  return (
    <div
      className="toast-host"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: "var(--pd-z-toast)" as unknown as number,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: "min(360px, calc(100vw - 32px))",
        pointerEvents: "none",
      }}
    >
      {items.map((t) => {
        const style = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: "auto",
              padding: "10px 14px",
              borderRadius: "var(--pd-radius-lg)",
              background: style.bg,
              border: `1px solid ${style.border}`,
              color: style.color,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "var(--pd-shadow-lg)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              animation: "slide-in-up 160ms var(--pd-ease)",
            }}
          >
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.msg}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                opacity: 0.6,
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
