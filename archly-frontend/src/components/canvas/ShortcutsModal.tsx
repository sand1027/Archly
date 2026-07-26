"use client";

import { useEffect, type CSSProperties } from "react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "⌘ / Ctrl + K", action: "Command palette" },
  { keys: "Alt + M", action: "Open Mermaid editor" },
  { keys: "Alt + A", action: "Open AI Generate" },
  { keys: "Alt + C", action: "Open AI Chat" },
  { keys: "Alt + G", action: "Toggle student guide" },
  { keys: "Alt + S", action: "Save session" },
  { keys: "Alt + H", action: "Toggle history panel" },
  { keys: "Alt + D", action: "Design mode" },
  { keys: "Alt + E", action: "Export mode" },
  { keys: "Alt + 1", action: "Switch to Freehand" },
  { keys: "Alt + 2", action: "Switch to Flow" },
  { keys: "?", action: "Show this shortcuts list" },
  { keys: "Ctrl + Z", action: "Undo (Flow)" },
  { keys: "Ctrl + Shift + Z", action: "Redo (Flow)" },
];

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div role="presentation" onClick={onClose} style={overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        style={card}
      >
        <div style={header}>
          <h2 id="shortcuts-title" style={titleStyle}>
            Keyboard shortcuts
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={closeBtn}>
            ✕
          </button>
        </div>
        <div style={{ padding: "8px 16px 16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td style={keyCell}>
                    <kbd style={kbd}>{s.keys}</kbd>
                  </td>
                  <td style={actionCell}>{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 400,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(420px, 100%)",
  background: "var(--pd-surface-raised)",
  border: "1px solid var(--pd-border)",
  borderRadius: "var(--pd-radius-lg, 12px)",
  boxShadow: "var(--pd-shadow)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid var(--pd-border)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 800,
  color: "var(--pd-text)",
};

const closeBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
};

const keyCell: CSSProperties = {
  padding: "8px 8px 8px 0",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const actionCell: CSSProperties = {
  padding: "8px 0",
  fontSize: 13,
  color: "var(--pd-text)",
};

const kbd: CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg-muted)",
  color: "var(--pd-text)",
};
