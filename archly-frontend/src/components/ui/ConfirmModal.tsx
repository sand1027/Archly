"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={overlay}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={card}
      >
        <div style={header}>
          <h2 id="confirm-modal-title" style={titleStyle}>
            {title}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" style={closeBtn}>
            ✕
          </button>
        </div>
        <p style={messageStyle}>{message}</p>
        <div style={actions}>
          <button type="button" onClick={onCancel} style={secondaryBtn}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              ...primaryBtn,
              background: danger ? "#dc2626" : "var(--pd-brand)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 15, 17, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  backdropFilter: "blur(2px)",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "var(--pd-surface)",
  border: "1px solid var(--pd-border)",
  borderRadius: 14,
  boxShadow: "var(--pd-shadow-lg)",
  padding: "18px 20px 16px",
  animation: "fade-in 140ms ease",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 8,
};

const titleStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  fontSize: 16,
  fontWeight: 800,
  color: "var(--pd-text)",
  letterSpacing: "-0.01em",
};

const closeBtn: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const messageStyle: CSSProperties = {
  margin: "0 0 18px",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--pd-text-muted)",
};

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const secondaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "var(--pd-radius)",
  border: "none",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

/** Optional helper type export for reuse */
export type ConfirmModalNode = ReactNode;
