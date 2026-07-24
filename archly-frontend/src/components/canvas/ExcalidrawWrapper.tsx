"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/store/canvas.store";
import { useSimulationStore } from "@/store/simulation.store";
import { setExcalidrawAPI } from "@/lib/excalidraw-api";
import type { ExcalidrawElement } from "@/types";

// Must import Excalidraw's CSS — without it SVG icons have no size
// constraints and stretch to fill the full container
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => {
    const { Excalidraw } = await import("@excalidraw/excalidraw");
    return Excalidraw;
  },
  { ssr: false, loading: () => <ExcalidrawSkeleton /> }
);

interface ExcalidrawWrapperProps {
  onSendCollabUpdate?: (elements: ExcalidrawElement[]) => void;
  readOnly?: boolean;
}

// Module-level flush timer — shared across all instances (there's only one)
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingElements: ExcalidrawElement[] | null = null;
let pendingSelectedIds: string[] | null = null;

// Sanitize elements from any source (mermaid, collab, etc.) before
// passing to Excalidraw — undefined array/object fields cause crashes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(els: any[]): any[] {
  if (!Array.isArray(els)) return [];
  return els
    .filter((e) => e != null && typeof e === "object" && e.id && e.type)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => ({
      ...e,
      // Required arrays — must never be undefined
      groupIds:      Array.isArray(e.groupIds)      ? e.groupIds      : [],
      boundElements: Array.isArray(e.boundElements) ? e.boundElements : [],
      // Required nullable fields
      frameId:  e.frameId  ?? null,
      link:     e.link     ?? null,
      locked:   e.locked   ?? false,
      // Text element fields
      ...(e.type === "text" && {
        text:         e.text         ?? "",
        originalText: e.originalText ?? e.text ?? "",
        fontSize:     e.fontSize     ?? 16,
        fontFamily:   e.fontFamily   ?? 1,
        textAlign:    e.textAlign    ?? "left",
        verticalAlign: e.verticalAlign ?? "top",
        containerId:  e.containerId  ?? null,
        lineHeight:   e.lineHeight   ?? 1.25,
        autoResize:   e.autoResize   ?? true,
      }),
      // Arrow element fields
      ...(e.type === "arrow" && {
        points:       Array.isArray(e.points) ? e.points : [],
        startBinding: e.startBinding ?? null,
        endBinding:   e.endBinding   ?? null,
        startArrowhead: e.startArrowhead ?? null,
        endArrowhead:   e.endArrowhead   ?? "arrow",
      }),
      // Line element fields
      ...(e.type === "line" && {
        points: Array.isArray(e.points) ? e.points : [],
      }),
    }));
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (pendingElements !== null) {
      useCanvasStore.getState().setElements(sanitize(pendingElements) as ExcalidrawElement[]);
      pendingElements = null;
    }
    if (pendingSelectedIds !== null) {
      useCanvasStore.getState().setSelectedElementIds(pendingSelectedIds);
      pendingSelectedIds = null;
    }
  }, 0);
}

export default function ExcalidrawWrapper({
  onSendCollabUpdate,
  readOnly = false,
}: ExcalidrawWrapperProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawApiRef = useRef<any>(null);
  const collabRef = useRef(onSendCollabUpdate);
  useEffect(() => { collabRef.current = onSendCollabUpdate; });

  // Capture initial data once — no subscription
  const initialDataRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
    viewBackgroundColor: string;
    theme: "light" | "dark";
  } | null>(null);

  if (initialDataRef.current === null) {
    const state = useCanvasStore.getState();
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    initialDataRef.current = {
      elements: sanitize(state.elements as unknown[]),
      viewBackgroundColor: state.appState?.viewBackgroundColor ?? "#ffffff",
      theme: isDark ? "dark" : "light",
    };
  }

  // Theme: sync via MutationObserver — no prop, no re-render
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      excalidrawApiRef.current?.updateScene({
        appState: { theme: isDark ? "dark" : "light" },
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // onChange: NEVER calls setState/Zustand directly.
  // Buffers into module-level vars and flushes via setTimeout(0),
  // which runs AFTER React finishes its current commit — breaking the loop.
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (els: readonly any[], newAppState: any) => {
      const typedEls = els as ExcalidrawElement[];

      // Buffer — overwrite with latest value, flush once after this frame
      pendingElements = typedEls;

      const selectedIds = Object.keys(newAppState.selectedElementIds ?? {}).filter(
        (id) => newAppState.selectedElementIds[id]
      );
      pendingSelectedIds = selectedIds;

      scheduleFlush();

      // Chaos injection is synchronous user action — safe to call directly
      const pending = useSimulationStore.getState().pendingChaosType;
      if (pending && selectedIds.length === 1) {
        useSimulationStore.getState().injectChaos({
          id: `chaos-${Date.now()}`,
          type: pending,
          nodeId: selectedIds[0],
          params: {},
          injectedAt: Date.now(),
        });
        useSimulationStore.getState().setPendingChaosType(null);
      }

      // Collab: fire-and-forget, doesn't touch React state
      collabRef.current?.(typedEls);
    },
    []
  );

  return (
    <div className="excalidraw-container">
      <Excalidraw
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        excalidrawAPI={(api: any) => {
          excalidrawApiRef.current = api;
          setExcalidrawAPI(api);
        }}
        initialData={{
          elements: initialDataRef.current.elements,
          appState: {
            viewBackgroundColor: initialDataRef.current.viewBackgroundColor,
            theme: initialDataRef.current.theme,
          },
        }}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        // zenModeEnabled hides the toolbar but keeps the canvas fully functional.
        // Users can still draw using keyboard shortcuts (V=select, H=hand, etc.)
        zenModeEnabled={false}
        UIOptions={{
          canvasActions: {
            export: readOnly ? false : { saveFileToDisk: true },
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}

function ExcalidrawSkeleton() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pd-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--pd-text-muted)",
        fontFamily: "Assistant, sans-serif",
        fontSize: 14,
      }}
    >
      Loading canvas…
    </div>
  );
}
