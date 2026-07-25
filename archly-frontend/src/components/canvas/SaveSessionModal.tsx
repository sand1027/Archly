"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { DesignKind } from "@/types";

interface SaveSessionModalProps {
  isOpen: boolean;
  kind: DesignKind;
  defaultTitle: string;
  saving?: boolean;
  onSave: (title: string) => void;
  onCancel: () => void;
}

export default function SaveSessionModal({
  isOpen,
  kind,
  defaultTitle,
  saving = false,
  onSave,
  onCancel,
}: SaveSessionModalProps) {
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    if (isOpen) setTitle(defaultTitle);
  }, [isOpen, defaultTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    onSave(trimmed);
  };

  return (
    <div role="presentation" onClick={onCancel} style={overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={card}
      >
        <div style={header}>
          <h2 id="save-modal-title" style={titleStyle}>
            Save {kind === "flow" ? "Flow" : "Canvas"} session
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" style={closeBtn}>
            ✕
          </button>
        </div>

        <label style={label}>Session name</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={defaultTitle}
          style={input}
        />

        <div style={actions}>
          <button type="button" onClick={onCancel} style={secondaryBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || saving}
            style={{
              ...primaryBtn,
              opacity: !title.trim() || saving ? 0.6 : 1,
              cursor: !title.trim() || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
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
  marginBottom: 14,
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

const label: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--pd-text-muted)",
  marginBottom: 6,
};

const input: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg-subtle)",
  color: "var(--pd-text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 18,
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
  background: "var(--pd-brand)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
};
