"use client";

import type { CSSProperties, ReactNode } from "react";
import PropertiesPanel from "@/components/canvas/PropertiesPanel";
import AiStudioDock, { type AiDockTab } from "@/components/ai/AiStudioDock";
import ChaosPanel from "@/components/simulation/ChaosPanel";
import SchemaAiPanel from "@/components/schema/SchemaAiPanel";
import SchemaPropertiesPanel from "@/components/schema/SchemaPropertiesPanel";
import type { CanvasKind } from "@/lib/ai/diagram-snapshot";
import type { AiProvider } from "@/lib/ai/providers";
import type { StudioMode } from "@/components/studio/StudioModeBar";

export type RightSidebarTab = "ai" | "config" | "chaos";

interface Props {
  tab: RightSidebarTab;
  onTabChange: (tab: RightSidebarTab) => void;
  mode: StudioMode;
  activeCanvas: "canvas" | "flow";
  canvasKind: CanvasKind;
  onPreferFlow?: () => void;
  /** Jump to Schema studio when AI generates an ERD */
  onPreferSchema?: () => void;
  aiSubTab: AiDockTab;
  onAiSubTabChange: (tab: AiDockTab) => void;
  initialPrompt?: string | null;
  initialProvider?: AiProvider | null;
  autoStart?: boolean;
  onAiSeedClear?: () => void;
  chaosCount?: number;
  /** Schema-mode AI seed */
  schemaSeed?: {
    prompt: string;
    provider: AiProvider;
    autoStart: boolean;
    nonce?: number;
  } | null;
  onSchemaSeedClear?: () => void;
  /** Schema → Architecture bridge */
  onArchitectureForThis?: (prompt: string, provider: AiProvider) => void;
}

export default function RightSidebar({
  tab,
  onTabChange,
  mode,
  activeCanvas,
  canvasKind,
  onPreferFlow,
  onPreferSchema,
  aiSubTab,
  onAiSubTabChange,
  initialPrompt,
  initialProvider,
  autoStart,
  onAiSeedClear,
  chaosCount = 0,
  schemaSeed,
  onSchemaSeedClear,
  onArchitectureForThis,
}: Props) {
  const tabs =
    mode === "schema"
      ? ([
          { id: "ai" as const, label: "AI" },
          { id: "config" as const, label: "Table" },
        ] as const)
      : mode === "simulate"
        ? ([
            { id: "chaos" as const, label: chaosCount > 0 ? `Chaos · ${chaosCount}` : "Chaos" },
            { id: "config" as const, label: "Config" },
          ] as const)
        : ([
            { id: "ai" as const, label: "AI" },
            { id: "config" as const, label: "Config" },
          ] as const);

  return (
    <aside
      className="right-sidebar"
      style={{
        width: "var(--pd-right-panel-width)",
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--pd-sidebar-bg)",
        borderLeft: "1px solid var(--pd-sidebar-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          borderBottom: "1px solid var(--pd-border)",
          background: "var(--pd-surface)",
        }}
      >
        {tabs.map((t) => (
          <TabBtn
            key={t.id}
            active={tab === t.id}
            onClick={() => onTabChange(t.id)}
            label={t.label}
          />
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {mode === "schema" ? (
          tab === "config" ? (
            <SchemaPropertiesPanel />
          ) : (
            <SchemaAiPanel
              key={schemaSeed?.nonce ?? "schema-ai"}
              initialPrompt={schemaSeed?.prompt ?? null}
              initialProvider={schemaSeed?.provider ?? null}
              autoStart={schemaSeed?.autoStart ?? false}
              onSeedConsumed={onSchemaSeedClear}
              onArchitectureForThis={onArchitectureForThis}
            />
          )
        ) : tab === "chaos" ? (
          <ChaosPanel layout="dock" isOpen />
        ) : tab === "ai" ? (
          <AiStudioDock
            layout="sidebar"
            isOpen
            onClose={() => onTabChange("config")}
            tab={aiSubTab}
            onTabChange={onAiSubTabChange}
            canvas={canvasKind}
            onPreferFlow={onPreferFlow}
            onPreferSchema={onPreferSchema}
            initialPrompt={initialPrompt}
            initialProvider={initialProvider}
            autoStart={autoStart}
            onSeedConsumed={onAiSeedClear}
          />
        ) : (
          <PropertiesPanel activeTab={activeCanvas} embedded />
        )}
      </div>
    </aside>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 0",
        border: "none",
        background: "transparent",
        fontSize: 12,
        fontWeight: active ? 800 : 600,
        color: active ? "var(--pd-brand)" : "var(--pd-text-muted)",
        cursor: "pointer",
        borderBottom: active ? "2px solid var(--pd-brand)" : "2px solid transparent",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

export function RightSidebarShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "contents" } as CSSProperties}>{children}</div>;
}
