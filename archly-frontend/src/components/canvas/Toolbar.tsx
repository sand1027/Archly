"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTheme } from "@/providers/theme-provider";
import { useAuth } from "@/providers/auth-provider";
import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";

interface ToolbarProps {
  onOpenMermaid: () => void;
  onOpenAi: () => void;
  onOpenChat: () => void;
  onOpenGuide: () => void;
  onOpenShare: () => void;
  onOpenInterview: () => void;
  onPublish: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenHistory: () => void;
  onOpenExport?: () => void;
  onOpenShortcuts?: () => void;
  onOpenCommands?: () => void;
}

export default function Toolbar({
  onOpenMermaid,
  onOpenAi,
  onOpenChat,
  onOpenGuide,
  onOpenShare,
  onOpenInterview,
  onPublish,
  onSave,
  onSaveAs,
  onOpenHistory,
  onOpenExport,
  onOpenShortcuts,
  onOpenCommands,
}: ToolbarProps) {
  const { resolvedTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDirty } = useCanvasStore();
  const { isRunning } = useSimulationStore();
  const isDark = resolvedTheme === "dark";

  return (
    <header
      style={{
        height: "var(--pd-toolbar-height)",
        background: "var(--pd-toolbar-bg)",
        borderBottom: "1px solid var(--pd-toolbar-border)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 10px",
        zIndex: 100,
        flexShrink: 0,
        userSelect: "none",
        boxShadow: "var(--pd-shadow-sm)",
        isolation: "isolate",
        position: "relative",
      }}
    >
      <Link
        href="/canvas"
        aria-label="Archly"
        style={{
          display: "flex",
          alignItems: "center",
          textDecoration: "none",
          marginRight: 6,
          padding: "2px 6px",
          borderRadius: "var(--pd-radius)",
          transition: "background var(--pd-duration)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pd-bg-muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <img
          src="/brand-navbar.png"
          alt="Archly"
          height={26}
          width={104}
          draggable={false}
          style={{
            height: 26,
            width: "auto",
            display: "block",
            filter: isDark ? undefined : "invert(1) hue-rotate(180deg)",
          }}
        />
      </Link>

      <Divider />

      <Btn label="Mermaid" onClick={onOpenMermaid} title="Mermaid → canvas (Alt+M)" />
      <Btn label="AI" onClick={onOpenAi} title="Open AI Generate (Alt+A)" />
      <Btn label="Chat" onClick={onOpenChat} title="Open AI Chat (Alt+C)" />

      <MoreMenu
        items={[
          ...(onOpenCommands
            ? [{ label: "Command palette", onClick: onOpenCommands, hint: "⌘K" }]
            : []),
          { label: "Guide", onClick: onOpenGuide, hint: "Alt+G" },
          { label: "Community", href: "/community", hint: "Browse published designs" },
          { label: "Interview", onClick: onOpenInterview, hint: "System design practice" },
          { type: "sep" },
          ...(onOpenShortcuts
            ? [{ label: "Keyboard shortcuts", onClick: onOpenShortcuts, hint: "?" }]
            : []),
        ]}
      />

      <div style={{ flex: 1 }} />

      {isRunning && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            background: "color-mix(in srgb, var(--pd-brand) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pd-brand) 30%, transparent)",
            color: "var(--pd-brand)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--pd-brand)",
              animation: "arch-dot-bounce 1s ease infinite",
            }}
          />
          Live
        </div>
      )}

      {isDirty && !isRunning && (
        <span
          title="Unsaved changes"
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--pd-sim-warn)",
            display: "inline-block",
            marginRight: 4,
          }}
        />
      )}

      <Btn label="Save" onClick={onSave} title="Save this session (Alt+S)" primary />
      <Btn label="Share" onClick={onOpenShare} title="Share canvas" />

      <MoreMenu
        label="File"
        items={[
          { label: "Save as…", onClick: onSaveAs, hint: "New session copy" },
          { label: "History", onClick: onOpenHistory, hint: "Saved sessions (Alt+H)" },
          ...(onOpenExport
            ? [{ label: "Export…", onClick: onOpenExport, hint: "PNG / SVG / Mermaid" }]
            : []),
          ...(isAuthenticated
            ? [
                { type: "sep" as const },
                { label: "Publish to gallery", onClick: onPublish, hint: "Community" },
              ]
            : []),
        ]}
      />

      <Divider />

      {isAuthenticated ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            title={user?.displayName ?? "Account"}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--pd-text-muted)",
              maxWidth: 100,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.displayName ?? "Account"}
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            title="Sign out"
            style={{
              padding: "4px 10px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "transparent",
              color: "var(--pd-text-muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          style={{
            padding: "5px 14px",
            borderRadius: "var(--pd-radius)",
            background: "var(--pd-brand)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Sign up
        </Link>
      )}
    </header>
  );
}

type MenuItem =
  | { type: "sep" }
  | { label: string; onClick?: () => void; href?: string; hint?: string };

function MoreMenu({ label = "More", items }: { label?: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = 200;
    setBox({
      top: r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - width - 8),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: 200,
              zIndex: 400,
              padding: 4,
              borderRadius: 10,
              border: "1px solid var(--pd-border)",
              background: "var(--pd-surface-raised)",
              boxShadow: "var(--pd-shadow-lg)",
            }}
          >
            {items.map((item, i) => {
              if ("type" in item && item.type === "sep") {
                return (
                  <div
                    key={`sep-${i}`}
                    style={{
                      height: 1,
                      background: "var(--pd-border)",
                      margin: "4px 6px",
                    }}
                  />
                );
              }
              const it = item as Exclude<MenuItem, { type: "sep" }>;
              const shared: CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
                border: "none",
                borderRadius: 6,
                background: "transparent",
                color: "var(--pd-text)",
                fontSize: 12.5,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "left",
                textDecoration: "none",
              };
              const body = (
                <>
                  <span>{it.label}</span>
                  {it.hint && (
                    <span style={{ fontSize: 10, color: "var(--pd-text-subtle)" }}>{it.hint}</span>
                  )}
                </>
              );
              if (it.href) {
                return (
                  <Link
                    key={it.label}
                    href={it.href}
                    role="menuitem"
                    style={shared}
                    onClick={() => setOpen(false)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--pd-bg-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {body}
                  </Link>
                );
              }
              return (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  style={shared}
                  onClick={() => {
                    it.onClick?.();
                    setOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--pd-bg-muted)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {body}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 9px",
          borderRadius: "var(--pd-radius)",
          border: "none",
          background: open ? "var(--pd-bg-muted)" : "transparent",
          color: open ? "var(--pd-text)" : "var(--pd-text-muted)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          flexShrink: 0,
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = "var(--pd-bg-muted)";
            e.currentTarget.style.color = "var(--pd-text)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--pd-text-muted)";
          }
        }}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {menu}
    </>
  );
}

function Btn({
  label,
  onClick,
  title,
  primary,
}: {
  label: string;
  onClick: () => void;
  title?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        padding: primary ? "5px 12px" : "5px 9px",
        borderRadius: "var(--pd-radius)",
        border: primary ? "none" : "none",
        background: primary ? "var(--pd-brand)" : "transparent",
        color: primary ? "#fff" : "var(--pd-text-muted)",
        fontSize: 12,
        fontWeight: primary ? 700 : 500,
        cursor: "pointer",
        transition: "background var(--pd-duration), color var(--pd-duration)",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (primary) {
          e.currentTarget.style.background = "var(--pd-brand-hover)";
        } else {
          e.currentTarget.style.background = "var(--pd-bg-muted)";
          e.currentTarget.style.color = "var(--pd-text)";
        }
      }}
      onMouseLeave={(e) => {
        if (primary) {
          e.currentTarget.style.background = "var(--pd-brand)";
        } else {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--pd-text-muted)";
        }
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "var(--pd-border)",
        margin: "0 3px",
        flexShrink: 0,
      }}
    />
  );
}
