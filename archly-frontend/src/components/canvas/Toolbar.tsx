"use client";

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
}: ToolbarProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDirty } = useCanvasStore();
  const { isRunning } = useSimulationStore();

  const isDark = resolvedTheme === "dark";

  return (
    <header style={{
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
    }}>

      {/* ── Logo ── */}
      <Link href="/canvas" style={{
        display: "flex", alignItems: "center",
        textDecoration: "none", marginRight: 6,
        padding: "4px 8px", borderRadius: "var(--pd-radius)",
        transition: "background var(--pd-duration)",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--pd-bg-muted)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{
          fontWeight: 800,
          fontSize: 15,
          color: "var(--pd-text)",
          letterSpacing: "-0.02em",
        }}>
          archly
        </span>
      </Link>

      <Divider />

      {/* ── Tools ── */}
      <Btn label="Mermaid" onClick={onOpenMermaid} title="Mermaid → canvas (Alt+M)" />
      <Btn label="AI" onClick={onOpenAi} title="AI text-to-diagram (Alt+A)" />
      <Btn label="Chat" onClick={onOpenChat} title="Architecture chat (Alt+C)" />
      <Btn label="Guide" onClick={onOpenGuide} title="Student guide (Alt+G)" />

      <Divider />

      <NavLink href="/community" label="Community" />
      <Btn label="Interview" onClick={onOpenInterview} title="System design practice" />

      <div style={{ flex: 1 }} />

      {isRunning && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: "var(--pd-radius-full)",
          background: "color-mix(in srgb, var(--pd-brand) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pd-brand) 30%, transparent)",
          color: "var(--pd-brand)", fontSize: 12, fontWeight: 700,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--pd-brand)",
          }} />
          Simulating
        </div>
      )}

      {isDirty && !isRunning && (
        <span
          title="Unsaved changes"
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--pd-sim-warn)",
            display: "inline-block",
          }}
        />
      )}

      <Divider />

      <Btn label="Save" onClick={onSave} title="Save this session (Alt+S)" />
      <Btn label="Save as" onClick={onSaveAs} title="Save as a new session" />
      <Btn label="History" onClick={onOpenHistory} title="Your saved sessions (Alt+H)" />
      {onOpenExport && (
        <Btn label="Export" onClick={onOpenExport} title="Export PNG / SVG / Mermaid" />
      )}
      <Btn label="Share" onClick={onOpenShare} title="Share canvas" />

      {isAuthenticated && (
        <Btn label="Publish" onClick={onPublish} title="Publish to gallery" />
      )}
      {onOpenShortcuts && (
        <Btn label="?" onClick={onOpenShortcuts} title="Keyboard shortcuts" />
      )}

      <button
        onClick={toggleTheme}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
        style={{
          padding: "5px 9px",
          borderRadius: "var(--pd-radius)",
          border: "1px solid var(--pd-border)",
          background: "transparent",
          color: "var(--pd-text-muted)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {isDark ? "Light" : "Dark"}
      </button>

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
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link href="/login" style={{
          padding: "5px 14px",
          borderRadius: "var(--pd-radius)",
          background: "var(--pd-brand)",
          color: "#fff", fontSize: 12, fontWeight: 700,
          textDecoration: "none",
        }}>
          Sign up
        </Link>
      )}
    </header>
  );
}

function Btn({ label, onClick, title }: {
  label: string; onClick: () => void; title?: string;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      display: "flex", alignItems: "center",
      padding: "5px 9px", borderRadius: "var(--pd-radius)",
      border: "none", background: "transparent",
      color: "var(--pd-text-muted)",
      fontSize: 12, fontWeight: 500, cursor: "pointer",
      transition: "background var(--pd-duration), color var(--pd-duration)",
      flexShrink: 0,
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "var(--pd-bg-muted)";
        (e.currentTarget as HTMLElement).style.color = "var(--pd-text)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--pd-text-muted)";
      }}
    >
      {label}
    </button>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center",
      padding: "5px 9px", borderRadius: "var(--pd-radius)",
      color: "var(--pd-text-muted)", fontSize: 12, fontWeight: 500,
      textDecoration: "none",
      transition: "background var(--pd-duration), color var(--pd-duration)",
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "var(--pd-bg-muted)";
        (e.currentTarget as HTMLElement).style.color = "var(--pd-text)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--pd-text-muted)";
      }}
    >
      {label}
    </Link>
  );
}

function Divider() {
  return (
    <div style={{
      width: 1, height: 18,
      background: "var(--pd-border)",
      margin: "0 3px", flexShrink: 0,
    }} />
  );
}
