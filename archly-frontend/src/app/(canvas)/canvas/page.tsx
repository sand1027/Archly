"use client";

/**
 * CanvasPage — main canvas layout with two tabs:
 *   "Canvas" → Excalidraw freehand drawing
 *   "Flow"   → React Flow node-edge diagram with live simulation
 *
 * Both tabs share:
 *   - ComponentPalette (left sidebar) for dragging components
 *   - PropertiesPanel (right sidebar) for node config + chaos
 *   - SimulationBar (bottom) for play/stop/traffic/speed
 *   - ChaosPanel, MermaidEditor, AiDiagramPanel (modals)
 *
 * CRITICAL: CanvasPage must NOT subscribe to store state that changes on
 * every Excalidraw onChange. Such subscriptions live in isolated leaf
 * components so re-renders are contained.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import Toolbar from "@/components/canvas/Toolbar";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import PropertiesPanel from "@/components/canvas/PropertiesPanel";
import SimulationBar from "@/components/canvas/SimulationBar";
import MetricsDisplay from "@/components/simulation/MetricsDisplay";
import PacketAnimator from "@/components/simulation/PacketAnimator";
import ChaosPanel from "@/components/simulation/ChaosPanel";
import MermaidEditor from "@/components/mermaid/MermaidEditor";
import AiDiagramPanel from "@/components/ai/AiDiagramPanel";
import CanvasChatPanel from "@/components/ai/CanvasChatPanel";
import GuidePanel from "@/components/guide/GuidePanel";

import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { useAuth } from "@/providers/auth-provider";
import { useCollaboration } from "@/hooks/useCollaboration";
import { usePublishDesign } from "@/hooks/useDesigns";
import { shareApi } from "@/lib/api/endpoints";
import { getComponent } from "@/lib/components-registry";
import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import type { ExcalidrawElement, ComponentDefinition } from "@/types";

// ── Lazy-loaded canvases ──────────────────────────────────────────────────
const ExcalidrawWrapper = dynamic(
  () => import("@/components/canvas/ExcalidrawWrapper"),
  { ssr: false }
);
const FlowCanvas = dynamic(
  () => import("@/components/flow/FlowCanvas"),
  { ssr: false, loading: () => (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--pd-text-subtle)", fontSize: 13,
    }}>Loading flow canvas…</div>
  )}
);

type CanvasTab = "canvas" | "flow";

export default function CanvasPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // ── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CanvasTab>("canvas");

  // Clear the other tab's selection synchronously when switching
  const handleTabSwitch = useCallback((tab: CanvasTab) => {
    // Always clear BOTH stores — no async, no race condition
    useCanvasStore.getState().setSelectedElementIds([]);
    useFlowStore.getState().setSelectedNodeId(null);
    setActiveTab(tab);
  }, []);

  /** Wipe the active canvas/flow in one shot (with confirm). */
  const handleClearActive = useCallback(() => {
    const label = activeTab === "flow" ? "Flow diagram" : "Canvas";
    const ok = window.confirm(
      `Clear the entire ${label}? This removes all nodes and connections. Chaos injections will also be cleared.`
    );
    if (!ok) return;

    if (activeTab === "flow") {
      useFlowStore.getState().reset();
    } else {
      const api = getExcalidrawAPI();
      api?.updateScene?.({ elements: [] });
      api?.history?.clear?.();
      useCanvasStore.getState().setElements([]);
      useCanvasStore.getState().setSelectedElementIds([]);
      // Drop per-node configs without wiping collab room state
      const configs = useCanvasStore.getState().nodeConfigs;
      for (const id of Object.keys(configs)) {
        useCanvasStore.getState().removeNodeConfig(id);
      }
      useCanvasStore.getState().markDirty();
    }

    useSimulationStore.getState().clearAllChaos();
    useSimulationStore.getState().stop();
    useSimulationStore.getState().setMetrics({});
    useSimulationStore.getState().updatePackets([]);
    useSimulationStore.getState().setBottlenecks([]);
  }, [activeTab]);

  // ── Panel / modal states ──────────────────────────────────────────────
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [aiOpen, setAiOpen]           = useState(false);
  const [chatOpen, setChatOpen]       = useState(false);
  const [guideOpen, setGuideOpen]     = useState(false);
  const [chaosOpen, setChaosOpen]     = useState(false);
  const [shareUrl, setShareUrl]       = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [publishMsg, setPublishMsg]   = useState<string | null>(null);

  // ── Store subscriptions — ONLY rarely-changing values ─────────────────
  const activeInjections = useSimulationStore((s) => s.activeInjections);
  const markClean        = useCanvasStore((s) => s.markClean);

  // ── Collab ────────────────────────────────────────────────────────────
  const roomId = (useCanvasStore.getState().appState as { roomId?: string })?.roomId ?? null;
  const { sendElementUpdate } = useCollaboration({ roomId, enabled: !!roomId });
  const sendCollabRef = useRef(sendElementUpdate);
  useEffect(() => { sendCollabRef.current = sendElementUpdate; }, [sendElementUpdate]);
  const stableSendCollab = useCallback((els: ExcalidrawElement[]) => {
    sendCollabRef.current(els);
  }, []);

  const publishMutation = usePublishDesign();

  // ── Drop handler (Excalidraw tab only) ────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Flow canvas handles its own drops internally
    if (activeTab === "flow") return;
    e.preventDefault();
    const compId = e.dataTransfer.getData("application/archly-component");
    if (!compId) return;
    const comp = getComponent(compId);
    if (!comp) return;

    const api = getExcalidrawAPI();
    if (api) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appState = api.getAppState() as any;
      const zoom = appState?.zoom?.value ?? 1;
      const scrollX = appState?.scrollX ?? 0;
      const scrollY = appState?.scrollY ?? 0;
      const canvasEl = document.querySelector(".excalidraw-container");
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) / zoom - scrollX - comp.defaultWidth / 2;
      const canvasY = (e.clientY - rect.top)  / zoom - scrollY - comp.defaultHeight / 2;
      addComponentToCanvas(comp, canvasX, canvasY);
    } else {
      const canvasEl = document.querySelector(".excalidraw-container");
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      addComponentToCanvas(comp, e.clientX - rect.left - comp.defaultWidth / 2, e.clientY - rect.top - comp.defaultHeight / 2);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const addComponentToCanvas = useCallback((comp: ComponentDefinition, x: number, y: number) => {
    const api = getExcalidrawAPI();
    const id = crypto.randomUUID();
    const rect: ExcalidrawElement = {
      id, type: "rectangle", x, y,
      width: comp.defaultWidth, height: comp.defaultHeight,
      angle: 0, strokeColor: comp.strokeColor, backgroundColor: comp.color,
      fillStyle: "solid", strokeWidth: 1.5, strokeStyle: "solid",
      roughness: 1, opacity: 100, groupIds: [id], roundness: { type: 3 },
      isDeleted: false, version: 1,
      versionNonce: Math.floor(Math.random() * 1e9),
      updated: Date.now(), link: null, locked: false,
      customData: { componentId: comp.id, label: comp.name },
      seed: Math.floor(Math.random() * 1e9), index: null, frameId: null, boundElements: null,
    };
    const labelEl: ExcalidrawElement = {
      id: crypto.randomUUID(), type: "text",
      x: x + comp.defaultWidth / 2 - 50, y: y + comp.defaultHeight / 2 - 10,
      width: 100, height: 20, angle: 0, strokeColor: comp.strokeColor,
      backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
      roughness: 0, opacity: 100, groupIds: [id], roundness: null,
      isDeleted: false, version: 1,
      versionNonce: Math.floor(Math.random() * 1e9),
      updated: Date.now(), link: null, locked: false,
      customData: { isLabel: true, parentId: id },
      seed: Math.floor(Math.random() * 1e9), index: null, frameId: null, boundElements: null,
      text: comp.name, fontSize: 13, fontFamily: 1,
      textAlign: "center", verticalAlign: "middle",
      containerId: null, originalText: comp.name, autoResize: true, lineHeight: 1.25,
    };
    if (api) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const current = api.getSceneElements() as any[];
      api.updateScene({ elements: [...current, rect, labelEl] });
    } else {
      const { elements, setElements } = useCanvasStore.getState();
      setElements([...elements, rect, labelEl]);
    }
  }, []);

  // ── Share ─────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const { elements } = useCanvasStore.getState();
    try {
      const result = await shareApi.create({ elements, ttlHours: 72 });
      const url = `${window.location.origin}/share/${result.slug}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      await navigator.clipboard.writeText(`${window.location.origin}/share/demo`).catch(() => null);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [isAuthenticated, router]);

  // ── Publish ───────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const { elements, appState } = useCanvasStore.getState();
    if (elements.length === 0) {
      setPublishMsg("Cannot publish empty canvas.");
      setTimeout(() => setPublishMsg(null), 2000);
      return;
    }
    try {
      await publishMutation.mutateAsync({ title: "My System Design", description: "", tags: [], elements, appState: appState as Record<string, unknown> });
      markClean();
      setPublishMsg("Design published ✓");
      setTimeout(() => setPublishMsg(null), 3000);
    } catch {
      setPublishMsg("Failed to publish. Please try again.");
      setTimeout(() => setPublishMsg(null), 3000);
    }
  }, [isAuthenticated, publishMutation, markClean, router]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "m") { e.preventDefault(); setMermaidOpen(true); }
      if (e.altKey && e.key === "a") { e.preventDefault(); setAiOpen(true); }
      if (e.altKey && e.key === "c") {
        e.preventDefault();
        setGuideOpen(false);
        setChatOpen((v) => !v);
      }
      if (e.altKey && e.key === "g") {
        e.preventDefault();
        setChatOpen(false);
        setGuideOpen((v) => !v);
      }
      // Tab switch: Alt+1 = Canvas, Alt+2 = Flow
      if (e.altKey && e.key === "1") { e.preventDefault(); handleTabSwitch("canvas"); }
      if (e.altKey && e.key === "2") { e.preventDefault(); handleTabSwitch("flow"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="canvas-page" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <Toolbar
        onOpenMermaid={() => setMermaidOpen(true)}
        onOpenAi={() => setAiOpen(true)}
        onOpenChat={() => { setGuideOpen(false); setChatOpen(true); }}
        onOpenGuide={() => { setChatOpen(false); setGuideOpen(true); }}
        onOpenShare={handleShare}
        onOpenInterview={() => router.push("/interview")}
        onPublish={handlePublish}
      />

      {/* ── Canvas / Flow tab bar ─────────────────────────────────────── */}
      <CanvasTabBar
        activeTab={activeTab}
        onSwitch={handleTabSwitch}
        onClear={handleClearActive}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Left: component palette — shared by both tabs */}
        <ComponentPalette />

        {/* Center: active canvas */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {/* ── Excalidraw tab ── */}
          <div style={{
            position: "absolute", inset: 0,
            display: activeTab === "canvas" ? "block" : "none",
          }}>
            <ExcalidrawWrapper onSendCollabUpdate={stableSendCollab} />
            <PacketAnimatorBridge />
            <MetricsDisplay />
            <EmptyCanvasHint />
          </div>

          {/* ── Flow tab ── */}
          <div style={{
            position: "absolute", inset: 0,
            display: activeTab === "flow" ? "flex" : "none",
            flexDirection: "column",
          }}>
            <FlowCanvas />
          </div>

          {/* Shared overlays (both tabs) */}
          <ChaosPanel isOpen={chaosOpen} onClose={() => setChaosOpen(false)} />
          <CanvasChatPanel
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            canvas={activeTab === "flow" ? "flow" : "excalidraw"}
          />
          <GuidePanel
            isOpen={guideOpen}
            onClose={() => setGuideOpen(false)}
            canvas={activeTab === "flow" ? "flow" : "excalidraw"}
            onPreferFlow={() => handleTabSwitch("flow")}
          />
          {shareCopied && <Toast msg={shareUrl ? `Link copied: ${shareUrl.slice(0, 40)}…` : "Link copied!"} />}
          {publishMsg  && <Toast msg={publishMsg} />}
        </div>

        {/* Right: properties panel — shared */}
        <PropertiesPanel activeTab={activeTab} />
      </div>

      <SimulationBar />

      {/* Floating chaos button */}
      <button
        onClick={() => setChaosOpen((v) => !v)}
        title="Chaos Engineering"
        style={{
          position: "fixed",
          bottom: "calc(var(--pd-simbar-height) + 12px)",
          left: "50%", transform: "translateX(-50%)",
          zIndex: 150, padding: "7px 18px",
          borderRadius: "var(--pd-radius-full)",
          background: activeInjections.length > 0 ? "var(--pd-chaos-crash)" : "var(--pd-surface-raised)",
          border: "1px solid var(--pd-border)",
          color: activeInjections.length > 0 ? "#fff" : "var(--pd-text-muted)",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          boxShadow: "var(--pd-shadow)", display: "flex", alignItems: "center", gap: 6,
          isolation: "isolate",
        }}
      >
        <span>⚡</span>
        <span>Chaos{activeInjections.length > 0 && ` (${activeInjections.length})`}</span>
      </button>

      <MermaidEditor isOpen={mermaidOpen} onClose={() => setMermaidOpen(false)} activeTab={activeTab} />
      <AiDiagramPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      <UnsavedIndicator />
    </div>
  );
}

// ─── Canvas/Flow tab bar ──────────────────────────────────────────────────

function CanvasTabBar({ activeTab, onSwitch, onClear }: {
  activeTab: CanvasTab;
  onSwitch: (t: CanvasTab) => void;
  onClear: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 2,
      padding: "0 14px",
      background: "var(--pd-toolbar-bg)",
      borderBottom: "1px solid var(--pd-toolbar-border)",
      flexShrink: 0,
      height: 36,
      isolation: "isolate",
      position: "relative",
      zIndex: 99,
    }}>
      <Tab
        label="✏️ Canvas"
        title="Excalidraw freehand canvas (Alt+1)"
        active={activeTab === "canvas"}
        onClick={() => onSwitch("canvas")}
      />
      <Tab
        label="⬡ Flow"
        title="Node-edge diagram with live simulation (Alt+2)"
        active={activeTab === "flow"}
        onClick={() => onSwitch("flow")}
        badge="NEW"
      />

      <button
        type="button"
        onClick={onClear}
        title={activeTab === "flow" ? "Clear all Flow nodes and edges" : "Clear entire Canvas"}
        style={{
          marginLeft: 10,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: "var(--pd-radius)",
          border: "1px solid var(--pd-border)",
          background: "transparent",
          color: "var(--pd-text-muted)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#dc2626";
          e.currentTarget.style.borderColor = "color-mix(in srgb, #dc2626 40%, transparent)";
          e.currentTarget.style.background = "color-mix(in srgb, #dc2626 8%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--pd-text-muted)";
          e.currentTarget.style.borderColor = "var(--pd-border)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span>🗑️</span>
        <span>Clear {activeTab === "flow" ? "Flow" : "Canvas"}</span>
      </button>

      {/* Keyboard hint */}
      <span style={{
        marginLeft: "auto", fontSize: 10, color: "var(--pd-text-subtle)",
        display: "flex", gap: 8,
      }}>
        <kbd style={kbdStyle}>Alt+1</kbd> Canvas
        <kbd style={kbdStyle}>Alt+2</kbd> Flow
      </span>
    </div>
  );
}

function Tab({ label, title, active, onClick, badge }: {
  label: string; title?: string; active: boolean;
  onClick: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 12px",
        border: "none", background: "transparent",
        color: active ? "var(--pd-brand)" : "var(--pd-text-muted)",
        fontSize: 12, fontWeight: active ? 700 : 500,
        cursor: "pointer",
        borderBottom: active
          ? "2px solid var(--pd-brand)"
          : "2px solid transparent",
        marginBottom: -1, // overlap parent border
        transition: "color 120ms, border-color 120ms",
        borderRadius: "var(--pd-radius-sm) var(--pd-radius-sm) 0 0",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "var(--pd-text)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "var(--pd-text-muted)";
      }}
    >
      <span>{label}</span>
      {badge && (
        <span style={{
          padding: "1px 5px",
          borderRadius: "var(--pd-radius-full)",
          background: "linear-gradient(135deg, var(--pd-brand), #8b5cf6)",
          color: "#fff", fontSize: 8, fontWeight: 800,
          letterSpacing: "0.04em",
        }}>{badge}</span>
      )}
    </button>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: "1px 5px",
  borderRadius: "var(--pd-radius-sm)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg-muted)",
  fontSize: 9, fontFamily: "ui-monospace, monospace",
  color: "var(--pd-text-subtle)",
};

// ─── Isolated leaf components ─────────────────────────────────────────────

function PacketAnimatorBridge() {
  const scrollX = useCanvasStore((s) => (s.appState as { scrollX?: number })?.scrollX ?? 0);
  const scrollY = useCanvasStore((s) => (s.appState as { scrollY?: number })?.scrollY ?? 0);
  const zoom    = useCanvasStore((s) => (s.appState as { zoom?: { value: number } })?.zoom?.value ?? 1);
  return <PacketAnimator scrollX={scrollX} scrollY={scrollY} zoom={zoom} />;
}

function EmptyCanvasHint() {
  const elementCount = useCanvasStore((s) => s.elements.length);
  const isRunning    = useSimulationStore((s) => s.isRunning);
  if (elementCount > 0 || isRunning) return null;
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <span style={{ fontSize: 40 }}>✏️</span>
      <p style={{ color: "var(--pd-text-subtle)", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
        Drag components from the left panel<br />or use AI / Mermaid to generate a diagram
      </p>
      <p style={{ color: "var(--pd-text-subtle)", fontSize: 12 }}>
        Alt+M — Mermaid &nbsp;·&nbsp; Alt+A — AI
      </p>
    </div>
  );
}

function UnsavedIndicator() {
  const isDirty = useCanvasStore((s) => s.isDirty);
  if (!isDirty) return null;
  return (
    <div style={{
      position: "fixed", bottom: "calc(var(--pd-simbar-height) + 12px)", right: 16,
      fontSize: 11, color: "var(--pd-text-subtle)", pointerEvents: "none",
    }}>
      Unsaved changes
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
      padding: "8px 18px", borderRadius: "var(--pd-radius-full)",
      background: "var(--pd-text)", color: "var(--pd-bg)",
      fontSize: 12, fontWeight: 600, pointerEvents: "none",
      zIndex: 200, whiteSpace: "nowrap", boxShadow: "var(--pd-shadow-lg)",
    }}>
      {msg}
    </div>
  );
}
