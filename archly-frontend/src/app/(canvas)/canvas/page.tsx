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

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import Toolbar from "@/components/canvas/Toolbar";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import SimulationBar from "@/components/canvas/SimulationBar";
import MetricsDisplay from "@/components/simulation/MetricsDisplay";
import PacketAnimator from "@/components/simulation/PacketAnimator";
import ChaosLegend from "@/components/simulation/ChaosLegend";
import MetricDeltaFlash from "@/components/simulation/MetricDeltaFlash";
import MermaidEditor from "@/components/mermaid/MermaidEditor";
import GuidePanel from "@/components/guide/GuidePanel";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ToastHost from "@/components/ui/ToastHost";
import HistoryPanel from "@/components/canvas/HistoryPanel";
import SaveSessionModal from "@/components/canvas/SaveSessionModal";
import ExportMenu from "@/components/canvas/ExportMenu";
import ShortcutsModal from "@/components/canvas/ShortcutsModal";
import BottleneckReport from "@/components/simulation/BottleneckReport";
import StudioModeBar, { type StudioMode } from "@/components/studio/StudioModeBar";
import OnboardingTour from "@/components/studio/OnboardingTour";
import FlowEmptyHero from "@/components/studio/FlowEmptyHero";
import SchemaCanvas from "@/components/schema/SchemaCanvas";
import SchemaPalette from "@/components/schema/SchemaPalette";
import SchemaEmptyHero from "@/components/schema/SchemaEmptyHero";
import RightSidebar, { type RightSidebarTab } from "@/components/canvas/RightSidebar";
import type { AiDockTab } from "@/components/ai/AiStudioDock";
import CommandPalette, { type CommandItem } from "@/components/ui/CommandPalette";
import ArchitectureLintPanel from "@/components/architecture/ArchitectureLintPanel";
import ArchitectureStoryPanel, {
  ArchitectureStoryLaunchButton,
} from "@/components/architecture/ArchitectureStoryPanel";
import ArchToolsFab from "@/components/architecture/ArchToolsFab";
import ArchitectureCritiquePanel from "@/components/architecture/ArchitectureCritiquePanel";
import ArchitectureBlastPanel from "@/components/architecture/ArchitectureBlastPanel";
import ArchitectureConstraintsPanel, {
  ArchitectureCostStrip,
  ArchitectureErasPanel,
} from "@/components/architecture/ArchitectureStudioPanels";
import ArchitectureGalleryModal from "@/components/architecture/ArchitectureGalleryModal";
import PromoteToFlowButton from "@/components/architecture/PromoteToFlowButton";
import { useStoryStore } from "@/store/story.store";
import { useArchitectureStudioStore } from "@/store/architecture-studio.store";
import { useSchemaStore } from "@/store/schema.store";

import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";
import { useFlowStore } from "@/store/flow.store";
import { toast } from "@/store/toast.store";
import { useAuth } from "@/providers/auth-provider";
import { useCollaboration } from "@/hooks/useCollaboration";
import { usePublishDesign, useSaveDesign, useUpdateDesign } from "@/hooks/useDesigns";
import { shareApi } from "@/lib/api/endpoints";
import type { AiProvider } from "@/lib/ai/providers";
import {
  snapshotActive,
  hydrateDesign,
  isActiveEmpty,
  writeLocalDraft,
  readLocalDraft,
  hydrateSnapshot,
  clearLocalDraft,
} from "@/lib/session/sessions";
import { getComponent } from "@/lib/components-registry";
import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { designsApi } from "@/lib/api/endpoints";
import type {
  ExcalidrawElement,
  ComponentDefinition,
  DesignKind,
  SavedDesign,
} from "@/types";

interface ActiveSession {
  id: string;
  title: string;
  kind: DesignKind;
}

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

  // ── Tab state — Flow is the primary studio surface ────────────────────
  const [activeTab, setActiveTab] = useState<CanvasTab>("flow");
  const [studioMode, setStudioMode] = useState<StudioMode>("design");
  const [aiSeed, setAiSeed] = useState<{
    prompt: string;
    provider: AiProvider;
    autoStart: boolean;
  } | null>(null);
  const [schemaSeed, setSchemaSeed] = useState<{
    prompt: string;
    provider: AiProvider;
    autoStart: boolean;
    nonce: number;
  } | null>(null);

  // Clear the other tab's selection synchronously when switching
  const handleTabSwitch = useCallback((tab: CanvasTab) => {
    // Always clear BOTH stores — no async, no race condition
    useCanvasStore.getState().setSelectedElementIds([]);
    useFlowStore.getState().setSelectedNodeId(null);
    if (tab !== "flow") useStoryStore.getState().stop();
    setActiveTab(tab);
  }, []);

  /** Open clear confirmation modal (no browser alerts). */
  const requestClearActive = useCallback(() => {
    setClearConfirmOpen(true);
  }, []);

  const handleClearActive = useCallback(() => {
    setClearConfirmOpen(false);

    if (studioMode === "schema") {
      useSchemaStore.getState().reset();
      setClearConfirmOpen(false);
      return;
    }

    if (activeTab === "flow") {
      useFlowStore.getState().reset();
    } else {
      const api = getExcalidrawAPI();
      api?.updateScene?.({ elements: [] });
      api?.history?.clear?.();
      useCanvasStore.getState().setElements([]);
      useCanvasStore.getState().setSelectedElementIds([]);
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

    // Forget the session bound to the tab we just cleared
    setCurrentSession((s) =>
      s && s.kind === (activeTab === "flow" ? "flow" : "canvas") ? null : s
    );
  }, [activeTab, studioMode]);

  // ── Panel / modal states ──────────────────────────────────────────────
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightSidebarTab>("ai");
  const [aiSubTab, setAiSubTab] = useState<AiDockTab>("generate");
  const [guideOpen, setGuideOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [shareUrl, setShareUrl]       = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [publishMsg, setPublishMsg]   = useState<string | null>(null);

  // ── Save / History sessions ───────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveAsMode, setSaveAsMode] = useState(false);
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [pendingOpen, setPendingOpen] = useState<SavedDesign | null>(null);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [bottleneckOpen, setBottleneckOpen] = useState(false);

  const handleStudioMode = useCallback((mode: StudioMode) => {
    setStudioMode(mode);
    if (mode !== "design" && mode !== "simulate") {
      useStoryStore.getState().stop();
    }
    if (mode === "simulate") {
      handleTabSwitch("flow");
      setRightTab("chaos");
    } else if (mode === "schema") {
      useSimulationStore.getState().stop();
      setRightTab("ai");
      setAiSubTab("generate");
    } else {
      useSimulationStore.getState().stop();
      if (mode === "design") setRightTab("ai");
    }
    if (mode === "export") setExportOpen(true);
  }, [handleTabSwitch]);

  const saveMutation = useSaveDesign();
  const updateMutation = useUpdateDesign();
  const currentSessionRef = useRef(currentSession);
  currentSessionRef.current = currentSession;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Store subscriptions — ONLY rarely-changing values
  const activeInjections = useSimulationStore((s) => s.activeInjections);
  const flowNodeCount = useFlowStore((s) => s.nodes.length);
  const schemaTableCount = useSchemaStore((s) => s.nodes.length);
  const storyActive = useStoryStore((s) => s.active);
  const archOverlay = useArchitectureStudioStore((s) => s.overlay);
  const galleryOpen = useArchitectureStudioStore((s) => s.galleryOpen);
  /** Full-canvas focus for Story / Guide / Arch overlays */
  const focusWalkthrough = storyActive || guideOpen || !!archOverlay || galleryOpen;
  const markClean        = useCanvasStore((s) => s.markClean);

  // ── Collab ────────────────────────────────────────────────────────────
  const roomId = (useCanvasStore.getState().appState as { roomId?: string })?.roomId ?? null;
  const { sendElementUpdate, sendFlowUpdate, status: collabStatus } = useCollaboration({
    roomId,
    enabled: !!roomId,
  });
  const sendCollabRef = useRef(sendElementUpdate);
  useEffect(() => { sendCollabRef.current = sendElementUpdate; }, [sendElementUpdate]);
  const stableSendCollab = useCallback((els: ExcalidrawElement[]) => {
    sendCollabRef.current(els);
  }, []);

  // Broadcast Flow changes when live
  useEffect(() => {
    if (!roomId || !sendFlowUpdate) return;
    const unsub = useFlowStore.subscribe((state, prev) => {
      if (state.nodes === prev.nodes && state.edges === prev.edges) return;
      sendFlowUpdate(state.nodes, state.edges);
    });
    return unsub;
  }, [roomId, sendFlowUpdate]);

  const startLiveRoom = useCallback(() => {
    const id = `room-${crypto.randomUUID().slice(0, 8)}`;
    useCanvasStore.getState().setAppState({ roomId: id });
    useCanvasStore.getState().setRoomId(id);
    setPublishMsg(`Live room: ${id}`);
    toast(`Live room started: ${id}`, "success");
    setTimeout(() => setPublishMsg(null), 3000);
    void navigator.clipboard.writeText(`${window.location.origin}/canvas?room=${id}`).catch(() => null);
  }, []);

  const joinLiveFromQuery = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      useCanvasStore.getState().setAppState({ roomId: room });
      useCanvasStore.getState().setRoomId(room);
      window.history.replaceState({}, "", "/canvas");
    }
  }, []);

  useEffect(() => {
    joinLiveFromQuery();
  }, [joinLiveFromQuery]);

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
    try {
      const payload =
        activeTab === "flow"
          ? {
              elements: {
                nodes: useFlowStore.getState().nodes,
                edges: useFlowStore.getState().edges,
              } as unknown as never[],
              appState: { kind: "flow" },
              ttlHours: 72,
            }
          : {
              elements: useCanvasStore.getState().elements,
              appState: useCanvasStore.getState().appState,
              ttlHours: 72,
            };
      const result = await shareApi.create(payload);
      const url = `${window.location.origin}/share/${result.slug}`;
      const embed = `${window.location.origin}/embed/${result.slug}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      toast(`Share link copied · embed: ${embed.slice(0, 42)}…`, "success", 3500);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      toast("Could not create share link", "error");
    }
  }, [isAuthenticated, router, activeTab]);

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

  // ── Save session ──────────────────────────────────────────────────────
  const flashMsg = useCallback((msg: string, kind: "info" | "success" | "warn" | "error" = "success") => {
    toast(msg, kind);
  }, []);

  const persistSession = useCallback(
    async (title: string, asNew = false) => {
      const kind: DesignKind = activeTab === "flow" ? "flow" : "canvas";
      const snapshot = snapshotActive(kind);
      const body = {
        title,
        description: "",
        tags: [],
        kind,
        elements: snapshot.elements,
        app_state: snapshot.app_state,
      };
      try {
        const reuse = !asNew && currentSession && currentSession.kind === kind;
        const saved = reuse
          ? await updateMutation.mutateAsync({ id: currentSession.id, body })
          : await saveMutation.mutateAsync(body);
        setCurrentSession({ id: saved.id, title: saved.title, kind });
        markClean();
        clearLocalDraft();
        flashMsg(reuse ? "Session updated ✓" : "Session saved ✓");
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          flashMsg("Sign in required to save — redirecting…");
          router.push("/login");
          return;
        }
        flashMsg("Failed to save. Please try again.");
      }
    },
    [activeTab, currentSession, saveMutation, updateMutation, markClean, flashMsg, router]
  );

  const handleSave = useCallback(() => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const kind: DesignKind = activeTab === "flow" ? "flow" : "canvas";
    if (isActiveEmpty(kind)) {
      flashMsg(`Nothing to save on the ${kind === "flow" ? "Flow" : "Canvas"} yet.`);
      return;
    }
    if (currentSession && currentSession.kind === kind) {
      void persistSession(currentSession.title);
    } else {
      setSaveAsMode(false);
      setSaveModalOpen(true);
    }
  }, [isAuthenticated, activeTab, currentSession, persistSession, flashMsg, router]);

  const handleSaveAs = useCallback(() => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const kind: DesignKind = activeTab === "flow" ? "flow" : "canvas";
    if (isActiveEmpty(kind)) {
      flashMsg(`Nothing to save on the ${kind === "flow" ? "Flow" : "Canvas"} yet.`);
      return;
    }
    setSaveAsMode(true);
    setSaveModalOpen(true);
  }, [isAuthenticated, activeTab, flashMsg, router]);

  // Autosave every ~8s when dirty + logged in + existing session for this tab
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => {
      const session = currentSessionRef.current;
      const tab = activeTabRef.current;
      const kind: DesignKind = tab === "flow" ? "flow" : "canvas";
      if (!session || session.kind !== kind) return;
      if (!useCanvasStore.getState().isDirty && kind === "canvas") {
        // Flow doesn't have isDirty — check emptiness / always snapshot when session exists
      }
      if (kind === "canvas" && !useCanvasStore.getState().isDirty) return;
      if (isActiveEmpty(kind)) return;
      const snapshot = snapshotActive(kind);
      writeLocalDraft(kind, snapshot, session.id);
      void updateMutation
        .mutateAsync({
          id: session.id,
          body: {
            title: session.title,
            description: "",
            tags: [],
            kind,
            elements: snapshot.elements,
            app_state: snapshot.app_state,
          },
        })
        .then(() => {
          markClean();
          flashMsg("Autosaved ✓");
        })
        .catch(() => {
          // keep local draft
        });
    }, 8000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, updateMutation, markClean, flashMsg]);

  // Local draft write on dirty (crash recovery)
  useEffect(() => {
    const id = window.setInterval(() => {
      const kind: DesignKind = activeTabRef.current === "flow" ? "flow" : "canvas";
      if (isActiveEmpty(kind)) return;
      if (kind === "canvas" && !useCanvasStore.getState().isDirty) return;
      writeLocalDraft(kind, snapshotActive(kind), currentSessionRef.current?.id);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  // Draft recovery + ?designId= open on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const designId = params.get("designId");
    if (designId) {
      void designsApi
        .getMine(designId)
        .then((d) => {
          const kind = (d as SavedDesign).kind === "flow" ? "flow" : "canvas";
          // Backend may return CommunityDesign shape — normalize
          const saved: SavedDesign = {
            id: (d as SavedDesign).id ?? designId,
            user_id: (d as SavedDesign).user_id ?? "",
            title: (d as SavedDesign).title ?? "Design",
            description: (d as SavedDesign).description ?? "",
            elements: (d as SavedDesign).elements ?? (d as { elements?: unknown }).elements,
            app_state:
              (d as SavedDesign).app_state ??
              (d as { app_state?: Record<string, unknown>; appState?: Record<string, unknown> })
                .app_state ??
              (d as { appState?: Record<string, unknown> }).appState ??
              {},
            tags: (d as SavedDesign).tags ?? [],
            published: (d as SavedDesign).published ?? false,
            kind: kind as DesignKind,
            created_at: (d as SavedDesign).created_at ?? "",
            updated_at: (d as SavedDesign).updated_at ?? "",
          };
          handleTabSwitch(kind);
          setTimeout(() => {
            hydrateDesign(saved);
            setCurrentSession({ id: saved.id, title: saved.title, kind: saved.kind });
          }, 80);
          window.history.replaceState({}, "", "/canvas");
        })
        .catch(() => flashMsg("Could not open design"));
      return;
    }
    const draft = readLocalDraft();
    if (draft && Date.now() - draft.savedAt < 1000 * 60 * 60 * 24) {
      setDraftPrompt(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Open a saved session ──────────────────────────────────────────────
  const performOpen = useCallback((design: SavedDesign) => {
    const targetTab: CanvasTab = design.kind === "flow" ? "flow" : "canvas";
    handleTabSwitch(targetTab);
    setTimeout(() => {
      hydrateDesign(design);
      setCurrentSession({ id: design.id, title: design.title, kind: design.kind });
      setHistoryOpen(false);
    }, 60);
  }, [handleTabSwitch]);

  const requestOpenSession = useCallback((design: SavedDesign) => {
    const targetKind: DesignKind = design.kind === "flow" ? "flow" : "canvas";
    if (!isActiveEmpty(targetKind)) {
      setPendingOpen(design);
    } else {
      performOpen(design);
    }
  }, [performOpen]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "m") { e.preventDefault(); setMermaidOpen(true); }
      if (e.altKey && e.key === "a") {
        e.preventDefault();
        setRightTab("ai");
        setAiSubTab("generate");
      }
      if (e.altKey && e.key === "c") {
        e.preventDefault();
        setGuideOpen(false);
        setRightTab("ai");
        setAiSubTab("chat");
      }
      if (e.altKey && e.key === "g") {
        e.preventDefault();
        setGuideOpen((v) => {
          const next = !v;
          if (next) useStoryStore.getState().stop();
          return next;
        });
      }
      if (e.altKey && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.altKey && e.key === "h") {
        e.preventDefault();
        setGuideOpen(false);
        setHistoryOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === "?" && !e.altKey && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setShortcutsOpen(true);
      }
      // Tab switch: Alt+1 = Canvas, Alt+2 = Flow
      if (e.altKey && e.key === "1") { e.preventDefault(); handleTabSwitch("canvas"); }
      if (e.altKey && e.key === "2") { e.preventDefault(); handleTabSwitch("flow"); }
      if (e.altKey && e.key.toLowerCase() === "d") { e.preventDefault(); handleStudioMode("design"); }
      if (e.altKey && e.key.toLowerCase() === "e") { e.preventDefault(); handleStudioMode("export"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave, handleTabSwitch, handleStudioMode]);

  const openAiGenerate = useCallback((prompt?: string, provider?: AiProvider) => {
    if (prompt) {
      setAiSeed({
        prompt,
        provider: provider ?? "groq",
        autoStart: true,
      });
    } else {
      setAiSeed(null);
    }
    handleTabSwitch("flow");
    setStudioMode("design");
    setRightTab("ai");
    setAiSubTab("generate");
  }, [handleTabSwitch]);

  const openSchemaGenerate = useCallback((prompt?: string, provider?: AiProvider) => {
    if (prompt) {
      setSchemaSeed({
        prompt,
        provider: provider ?? "groq",
        autoStart: true,
        nonce: Date.now(),
      });
    } else {
      setSchemaSeed(null);
    }
    setStudioMode("schema");
    setRightTab("ai");
  }, []);

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "save",
        label: "Save session",
        hint: "Alt+S",
        group: "File",
        keywords: ["persist"],
        run: () => handleSave(),
      },
      {
        id: "save-as",
        label: "Save as…",
        group: "File",
        run: () => handleSaveAs(),
      },
      {
        id: "export",
        label: "Export…",
        hint: "Alt+E",
        group: "File",
        keywords: ["png", "svg", "mermaid"],
        run: () => handleStudioMode("export"),
      },
      {
        id: "history",
        label: "Open history",
        hint: "Alt+H",
        group: "File",
        run: () => {
          setGuideOpen(false);
          setHistoryOpen(true);
        },
      },
      {
        id: "share",
        label: "Share link",
        group: "File",
        run: () => handleShare(),
      },
      {
        id: "clear",
        label: "Clear canvas",
        group: "Edit",
        keywords: ["reset", "delete all"],
        run: () => requestClearActive(),
      },
      {
        id: "mode-design",
        label: "Switch to Design",
        hint: "Alt+D",
        group: "Mode",
        run: () => handleStudioMode("design"),
      },
      {
        id: "mode-schema",
        label: "Switch to Schema",
        group: "Mode",
        keywords: ["database", "erd", "tables", "sql"],
        run: () => handleStudioMode("schema"),
      },
      {
        id: "mode-simulate",
        label: "Switch to Simulate",
        group: "Mode",
        keywords: ["chaos", "traffic"],
        run: () => handleStudioMode("simulate"),
      },
      {
        id: "schema-ai",
        label: "Generate database schema",
        group: "AI",
        keywords: ["erd", "tables"],
        run: () => openSchemaGenerate(),
      },
      {
        id: "mode-export",
        label: "Switch to Export",
        hint: "Alt+E",
        group: "Mode",
        run: () => handleStudioMode("export"),
      },
      {
        id: "tab-flow",
        label: "Switch to Flow",
        hint: "Alt+2",
        group: "Canvas",
        run: () => handleTabSwitch("flow"),
      },
      {
        id: "tab-freehand",
        label: "Switch to Freehand",
        hint: "Alt+1",
        group: "Canvas",
        run: () => handleTabSwitch("canvas"),
      },
      {
        id: "ai",
        label: "Open AI Generate",
        hint: "Alt+A",
        group: "AI",
        run: () => openAiGenerate(),
      },
      {
        id: "chat",
        label: "Open AI Chat",
        hint: "Alt+C",
        group: "AI",
        run: () => {
          setGuideOpen(false);
          setRightTab("ai");
          setAiSubTab("chat");
          // Stay in schema if already there; otherwise open Design chat
          if (studioMode !== "schema" && studioMode !== "design") {
            setStudioMode("design");
          }
        },
      },
      {
        id: "mermaid",
        label: "Open Mermaid editor",
        hint: "Alt+M",
        group: "AI",
        run: () => setMermaidOpen(true),
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        group: "Help",
        run: () => setShortcutsOpen(true),
      },
    ],
    [handleSave, handleSaveAs, handleShare, handleStudioMode, handleTabSwitch, openAiGenerate, openSchemaGenerate, requestClearActive, studioMode]
  );

  return (
    <div
      className="canvas-page"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        // Fixed dock reads this from the page root
        ["--ai-dock-lift" as string]:
          studioMode === "simulate" ? "var(--pd-simbar-height)" : "0px",
      }}
    >
      <ToastHost />
      <OnboardingTour />
      <Toolbar
        onOpenMermaid={() => setMermaidOpen(true)}
        onOpenAi={() => {
          setAiSeed(null);
          setRightTab("ai");
          setAiSubTab("generate");
        }}
        onOpenChat={() => {
          setGuideOpen(false);
          setRightTab("ai");
          setAiSubTab("chat");
        }}
        onOpenGuide={() => {
          useStoryStore.getState().stop();
          setGuideOpen(true);
        }}
        onOpenShare={handleShare}
        onOpenInterview={() => router.push("/interview")}
        onPublish={handlePublish}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onOpenHistory={() => { setGuideOpen(false); setHistoryOpen(true); }}
        onOpenExport={() => { setStudioMode("export"); setExportOpen(true); }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenCommands={() => setCommandOpen(true)}
      />

      <StudioModeBar
        mode={studioMode}
        onChange={handleStudioMode}
        canvasTab={activeTab}
        onCanvasTabChange={handleTabSwitch}
        onClear={requestClearActive}
        sessionTitle={currentSession?.title ?? null}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Left palette — hidden during Story / Guide focus */}
        {studioMode === "design" && !focusWalkthrough && <ComponentPalette />}
        {studioMode === "schema" && !focusWalkthrough && (
          <SchemaPalette onOpenAi={(prompt) => openSchemaGenerate(prompt)} />
        )}

        {/* Center: active canvas */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {studioMode === "schema" ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
              <SchemaCanvas />
              <SchemaEmptyHero
                visible={schemaTableCount === 0}
                onGenerate={(prompt, provider) => openSchemaGenerate(prompt, provider)}
                onOpenAi={() => openSchemaGenerate()}
              />
            </div>
          ) : (
            <>
          {/* ── Excalidraw (Freehand) tab ── */}
          <div style={{
            position: "absolute", inset: 0,
            display: activeTab === "canvas" ? "block" : "none",
          }}>
            <ExcalidrawWrapper onSendCollabUpdate={stableSendCollab} />
            {studioMode === "simulate" && (
              <>
                <PacketAnimatorBridge />
                <MetricsDisplay />
              </>
            )}
            <EmptyCanvasHint />
          </div>

          {/* ── Flow tab (primary) ── */}
          <div style={{
            position: "absolute", inset: 0,
            display: activeTab === "flow" ? "flex" : "none",
            flexDirection: "column",
          }}>
            <FlowCanvas />
            {studioMode === "design" && (
              <FlowEmptyHero
                visible={flowNodeCount === 0}
                onGenerate={(prompt, provider) => openAiGenerate(prompt, provider)}
                onOpenAi={() => openAiGenerate()}
                onOpenSchema={() => openSchemaGenerate()}
                onOpenGallery={() => useArchitectureStudioStore.getState().setGalleryOpen(true)}
              />
            )}
            {studioMode === "design" && activeTab === "flow" && !storyActive && !archOverlay && (
              <ArchitectureLintPanel />
            )}
            {(studioMode === "design" || studioMode === "simulate") && activeTab === "flow" && (
              <>
                {!storyActive && (
                  <ArchToolsFab lifted={studioMode === "simulate"} />
                )}
                <ArchitectureStoryLaunchButton
                  lifted={studioMode === "simulate"}
                  onActivate={() => {
                    setGuideOpen(false);
                    useArchitectureStudioStore.getState().clearOverlay();
                    useArchitectureStudioStore.getState().setGalleryOpen(false);
                  }}
                />
                <ArchitectureStoryPanel lifted={studioMode === "simulate"} />
                <ArchitectureCritiquePanel />
                <ArchitectureBlastPanel />
                <ArchitectureConstraintsPanel />
                <ArchitectureErasPanel />
                <ArchitectureCostStrip />
                <ArchitectureGalleryModal />
              </>
            )}
            {studioMode === "design" && activeTab === "canvas" && (
              <PromoteToFlowButton
                onDone={() => {
                  handleTabSwitch("flow");
                }}
              />
            )}
            {studioMode === "simulate" && (
              <>
                <ChaosLegend />
                <MetricDeltaFlash />
              </>
            )}
          </div>
            </>
          )}

          {/* Shared overlays (both tabs) */}
          <GuidePanel
            isOpen={guideOpen}
            onClose={() => setGuideOpen(false)}
            canvas={activeTab === "flow" ? "flow" : "excalidraw"}
            onPreferFlow={() => handleTabSwitch("flow")}
          />
          <HistoryPanel
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
            onOpenSession={requestOpenSession}
            onDuplicated={(d) => {
              setCurrentSession({ id: d.id, title: d.title, kind: d.kind });
              flashMsg("Duplicated — now editing copy");
            }}
            currentSessionId={currentSession?.id ?? null}
          />
        </div>

        {/* Right: AI + Config / Chaos + Config / Schema AI — hidden during Story / Guide */}
        {(studioMode === "design" || studioMode === "simulate" || studioMode === "schema") &&
          !focusWalkthrough && (
          <RightSidebar
            tab={
              studioMode === "simulate"
                ? rightTab === "ai"
                  ? "chaos"
                  : rightTab
                : rightTab === "chaos"
                  ? "ai"
                  : rightTab
            }
            onTabChange={setRightTab}
            mode={studioMode}
            activeCanvas={activeTab}
            canvasKind={activeTab === "flow" ? "flow" : "excalidraw"}
            onPreferFlow={() => handleTabSwitch("flow")}
            onPreferSchema={() => {
              setStudioMode("schema");
              setRightTab("ai");
            }}
            aiSubTab={aiSubTab}
            onAiSubTabChange={setAiSubTab}
            initialPrompt={aiSeed?.prompt ?? null}
            initialProvider={aiSeed?.provider ?? null}
            autoStart={aiSeed?.autoStart ?? false}
            onAiSeedClear={() => setAiSeed(null)}
            chaosCount={activeInjections.length}
            schemaSeed={schemaSeed}
            onSchemaSeedClear={() => setSchemaSeed(null)}
            onArchitectureForThis={(prompt, provider) => openAiGenerate(prompt, provider)}
            onOpenSchemaFromNode={(prompt) => openSchemaGenerate(prompt)}
          />
        )}
      </div>

      {studioMode === "simulate" && (
        <SimulationBar onOpenReport={() => setBottleneckOpen(true)} />
      )}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        commands={commands}
      />

      <MermaidEditor isOpen={mermaidOpen} onClose={() => setMermaidOpen(false)} activeTab={activeTab} />
      <ConfirmModal
        isOpen={clearConfirmOpen}
        title={
          studioMode === "schema"
            ? "Clear Schema?"
            : `Clear ${activeTab === "flow" ? "Flow" : "Canvas"}?`
        }
        message={
          studioMode === "schema"
            ? "This removes all tables and relationships from the schema. This can’t be undone."
            : `This removes all nodes and connections from the ${activeTab === "flow" ? "Flow diagram" : "Canvas"}. Chaos injections will also be cleared. This can’t be undone.`
        }
        confirmLabel="Clear everything"
        cancelLabel="Cancel"
        danger
        onConfirm={handleClearActive}
        onCancel={() => setClearConfirmOpen(false)}
      />
      <SaveSessionModal
        isOpen={saveModalOpen}
        kind={activeTab === "flow" ? "flow" : "canvas"}
        defaultTitle={
          saveAsMode && currentSession
            ? `${currentSession.title} (copy)`
            : `Untitled ${activeTab === "flow" ? "Flow" : "Canvas"}`
        }
        saving={saveMutation.isPending || updateMutation.isPending}
        onSave={async (title) => {
          setSaveModalOpen(false);
          await persistSession(title, saveAsMode);
          setSaveAsMode(false);
        }}
        onCancel={() => {
          setSaveModalOpen(false);
          setSaveAsMode(false);
        }}
      />
      <ConfirmModal
        isOpen={draftPrompt}
        title="Restore unsaved draft?"
        message="We found a local draft from this browser. Restore it onto the canvas?"
        confirmLabel="Restore draft"
        cancelLabel="Discard"
        onConfirm={() => {
          const draft = readLocalDraft();
          setDraftPrompt(false);
          if (!draft) return;
          if (draft.kind === "schema") {
            setStudioMode("schema");
          } else {
            handleTabSwitch(draft.kind === "flow" ? "flow" : "canvas");
          }
          setTimeout(() => {
            if (draft.kind === "schema") {
              const els = draft.elements as { nodes?: unknown[]; edges?: unknown[] };
              useSchemaStore.getState().setGraph(
                (els?.nodes as never[]) ?? [],
                (els?.edges as never[]) ?? []
              );
            } else {
              hydrateSnapshot(draft.kind, draft.elements, draft.app_state);
            }
            if (draft.sessionId) {
              setCurrentSession({
                id: draft.sessionId,
                title: "Restored session",
                kind: draft.kind,
              });
            }
          }, 60);
        }}
        onCancel={() => {
          clearLocalDraft();
          setDraftPrompt(false);
        }}
      />
      <ConfirmModal
        isOpen={pendingOpen !== null}
        title="Replace current work?"
        message={`Opening this session will replace what's on your ${pendingOpen?.kind === "flow" ? "Flow" : "Canvas"}. Unsaved changes will be lost.`}
        confirmLabel="Open session"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingOpen) performOpen(pendingOpen);
          setPendingOpen(null);
        }}
        onCancel={() => setPendingOpen(null)}
      />
      <ExportMenu
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        kind={studioMode === "schema" ? "schema" : activeTab === "flow" ? "flow" : "canvas"}
      />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <BottleneckReport isOpen={bottleneckOpen} onClose={() => setBottleneckOpen(false)} />
      <UnsavedIndicator lifted={studioMode === "simulate"} />
      {roomId && (
        <div
          style={{
            position: "fixed",
            bottom: studioMode === "simulate" ? "calc(var(--pd-simbar-height) + 52px)" : 16,
            left: 14,
            zIndex: 160,
            padding: "6px 10px",
            borderRadius: "var(--pd-radius-full)",
            background: "var(--pd-surface-raised)",
            border: "1px solid var(--pd-border)",
            fontSize: 11,
            fontWeight: 700,
            color: collabStatus === "connected" ? "var(--pd-brand)" : "var(--pd-text-muted)",
            boxShadow: "var(--pd-shadow-sm)",
          }}
        >
          Live · {roomId} · {collabStatus}
        </div>
      )}
      {!roomId && isAuthenticated && (
        <button
          type="button"
          onClick={startLiveRoom}
          title="Start a live collaboration room"
          style={{
            position: "fixed",
            bottom: studioMode === "simulate" ? "calc(var(--pd-simbar-height) + 52px)" : 16,
            left: 14,
            zIndex: 160,
            padding: "6px 12px",
            borderRadius: "var(--pd-radius-full)",
            background: "var(--pd-surface-raised)",
            border: "1px solid var(--pd-border)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--pd-text-muted)",
            cursor: "pointer",
            boxShadow: "var(--pd-shadow-sm)",
          }}
        >
          Go live
        </button>
      )}
    </div>
  );
}

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
      alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "var(--pd-bg-muted)",
        border: "1px solid var(--pd-border)",
        display: "grid", placeItems: "center",
        color: "var(--pd-text-subtle)", fontSize: 18, fontWeight: 700,
      }}>
        ⌖
      </div>
      <p style={{ color: "var(--pd-text)", fontSize: 14, fontWeight: 600, textAlign: "center", margin: 0 }}>
        Start from the left, or generate with AI
      </p>
      <p style={{ color: "var(--pd-text-subtle)", fontSize: 12, textAlign: "center", margin: 0, lineHeight: 1.5 }}>
        Drag components · Mermaid (Alt+M) · AI (Alt+A)
      </p>
    </div>
  );
}

function UnsavedIndicator({ lifted }: { lifted?: boolean }) {
  const isDirty = useCanvasStore((s) => s.isDirty);
  if (!isDirty) return null;
  return (
    <div style={{
      position: "fixed",
      bottom: lifted ? "calc(var(--pd-simbar-height) + 12px)" : 16,
      right: 16,
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
