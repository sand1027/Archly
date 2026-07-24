"use client";

import Link from "next/link";
import { useTheme } from "@/providers/theme-provider";
import { useAuth } from "@/providers/auth-provider";
import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";

interface ToolbarProps {
  onOpenMermaid: () => void;
  onOpenAi: () => void;
  onOpenShare: () => void;
  onOpenInterview: () => void;
  onPublish: () => void;
}

export default function Toolbar({
  onOpenMermaid,
  onOpenAi,
  onOpenShare,
  onOpenInterview,
  onPublish,
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
        display: "flex", alignItems: "center", gap: 7,
        textDecoration: "none", marginRight: 6,
        padding: "4px 8px", borderRadius: "var(--pd-radius)",
        transition: "background var(--pd-duration)",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--pd-bg-muted)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{
          width: 26, height: 26, borderRadius: "var(--pd-radius-sm)",
          background: "linear-gradient(135deg, #5b5ef4, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
          boxShadow: "0 2px 6px rgba(91,94,244,0.4)",
        }}>✏️</div>
        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--pd-text)", letterSpacing: "-0.01em" }}>
          Archly
        </span>
      </Link>

      <Divider />

      {/* ── Tools ── */}
      <Btn icon="📝" label="Mermaid" onClick={onOpenMermaid} title="Mermaid → canvas (Alt+M)" />
      <Btn icon="✨" label="AI" onClick={onOpenAi} title="AI text-to-diagram (Alt+A)" />

      <Divider />

      <NavLink href="/community" icon="🌐" label="Community" />
      <Btn icon="🎓" label="Interview" onClick={onOpenInterview} title="System design practice" />

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Simulation badge ── */}
      {isRunning && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: "var(--pd-radius-full)",
          background: "color-mix(in srgb, var(--pd-brand) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pd-brand) 30%, transparent)",
          color: "var(--pd-brand)", fontSize: 12, fontWeight: 700,
          animation: "fade-in 200ms ease",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--pd-brand)",
            animation: "pulse-ring 1.5s ease-in-out infinite",
          }} />
          Simulating
        </div>
      )}

      {/* ── Unsaved dot ── */}
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

      {/* ── Share ── */}
      <Btn icon="🔗" label="Share" onClick={onOpenShare} title="Share canvas" />

      {/* ── Publish ── */}
      {isAuthenticated && (
        <Btn icon="📤" label="Publish" onClick={onPublish} title="Publish to gallery" />
      )}

      {/* ── Theme toggle ── */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
        style={{
          width: 32, height: 32, borderRadius: "var(--pd-radius)",
          border: "1px solid var(--pd-border)",
          background: "var(--pd-bg-subtle)",
          color: "var(--pd-text-muted)",
          fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all var(--pd-duration) var(--pd-ease)",
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "var(--pd-bg-muted)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--pd-border-strong)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "var(--pd-bg-subtle)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--pd-border)";
        }}
      >
        {isDark ? "☀️" : "🌙"}
      </button>

      <Divider />

      {/* ── Auth ── */}
      {isAuthenticated ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--pd-brand), #8b5cf6)",
            color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800,
            boxShadow: "0 2px 6px rgba(91,94,244,0.35)",
          }} title={user?.displayName ?? "Account"}>
            {user?.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
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
          boxShadow: "0 2px 6px rgba(91,94,244,0.3)",
          transition: "background var(--pd-duration)",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--pd-brand-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--pd-brand)")}
        >
          Sign up
        </Link>
      )}

      {/* ── Plus badge — removed, everything is free ── */}
    </header>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Btn({ icon, label, onClick, title }: {
  icon: string; label: string; onClick: () => void; title?: string;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      display: "flex", alignItems: "center", gap: 5,
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
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 5,
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
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
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
