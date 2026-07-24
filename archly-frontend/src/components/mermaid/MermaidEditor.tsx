"use client";

import { useState, useCallback, useRef } from "react";
import {
  convertMermaidToCanvas,
  MERMAID_EXAMPLES,
} from "@/lib/mermaid-to-canvas";
import { convertMermaidToFlow } from "@/lib/mermaid-to-flow";
import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { useCanvasStore } from "@/store/canvas.store";
import { useFlowStore } from "@/store/flow.store";
import type { ExcalidrawElement } from "@/types";

// Lazily resolved — only imported when the user actually clicks "Add to Canvas"
let _convertToExcalidrawElements: ((els: unknown[]) => ExcalidrawElement[]) | null = null;
async function getConverter() {
  if (_convertToExcalidrawElements) return _convertToExcalidrawElements;
  const mod = await import("@excalidraw/excalidraw");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _convertToExcalidrawElements = (mod as any).convertToExcalidrawElements;
  return _convertToExcalidrawElements;
}

interface MermaidEditorProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which tab is currently active — determines where elements land */
  activeTab?: "canvas" | "flow";
}

type ExampleKey = keyof typeof MERMAID_EXAMPLES;

export default function MermaidEditor({ isOpen, onClose, activeTab = "canvas" }: MermaidEditorProps) {
  const [code, setCode] = useState<string>(MERMAID_EXAMPLES.flowchart);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Flow conversion ────────────────────────────────────────────────────
  const handleConvertToFlow = useCallback(async () => {
    setIsConverting(true);
    setError(null);
    setSuccessMsg(null);

    const result = await convertMermaidToFlow(code);

    if (!result.ok) {
      setError(result.error);
      setIsConverting(false);
      return;
    }

    const { nodes, edges } = result;

    if (nodes.length === 0) {
      setError("No nodes generated. Check your Mermaid syntax.");
      setIsConverting(false);
      return;
    }

    // Merge into flow store — skip nodes whose IDs already exist
    const { nodes: existing, edges: existingEdges } = useFlowStore.getState();
    const existingNodeIds = new Set(existing.map((n: { id: string }) => n.id));
    const existingEdgeKeys = new Set(
      existingEdges.map((e: { source: string; target: string }) => `${e.source}->${e.target}`)
    );

    // Offset new nodes so they don't overlap existing ones
    const offsetX = existing.length > 0
      ? Math.max(...existing.map((n: { position: { x: number } }) => n.position.x)) + 240
      : 0;

    const newNodes = nodes
      .filter((n) => !existingNodeIds.has(n.id))
      .map((n) => ({ ...n, position: { x: n.position.x + offsetX, y: n.position.y } }));

    const newEdges = edges.filter(
      (e) => !existingEdgeKeys.has(`${e.source}->${e.target}`)
    );

    useFlowStore.setState((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
    }));

    setSuccessMsg(
      `✓ Added ${newNodes.length} node${newNodes.length !== 1 ? "s" : ""} and ${newEdges.length} edge${newEdges.length !== 1 ? "s" : ""} to Flow canvas`
    );
    setIsConverting(false);

    setTimeout(() => {
      onClose();
      setSuccessMsg(null);
    }, 1200);
  }, [code, onClose]);

  // ── Canvas (Excalidraw) conversion ─────────────────────────────────────
  const handleConvertToCanvas = useCallback(async () => {
    setIsConverting(true);
    setError(null);
    setSuccessMsg(null);

    const result = await convertMermaidToCanvas(code);

    if (!result.ok) {
      setError(
        result.error.line
          ? `Line ${result.error.line}: ${result.error.message}`
          : result.error.message
      );
      setIsConverting(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeletons = result.data.elements as any[];

    if (skeletons.length === 0) {
      setError("No elements generated. Check your Mermaid syntax.");
      setIsConverting(false);
      return;
    }

    // Convert raw mermaid skeletons → proper Excalidraw elements.
    // This is the step that adds groupIds, boundElements, index, version, seed
    // etc. Without it Excalidraw's internal render crashes on undefined array fields.
    const converter = await getConverter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newElements: ExcalidrawElement[] = converter
      ? (converter(skeletons) as ExcalidrawElement[])
      : skeletons as ExcalidrawElement[];

    const api = getExcalidrawAPI();
    if (api) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const current = api.getSceneElements() as any[];
      const existingIds = new Set(current.map((e: { id: string }) => e.id));
      const toAdd = newElements.filter((e) => !existingIds.has(e.id));
      api.updateScene({ elements: [...current, ...toAdd] });
      setTimeout(() => api.scrollToContent?.(), 80);
    } else {
      const { elements, setElements } = useCanvasStore.getState();
      const existingIds = new Set(elements.map((e) => e.id));
      const toAdd = newElements.filter((e) => !existingIds.has(e.id));
      setElements([...elements, ...toAdd]);
    }

    setSuccessMsg(
      `✓ Added ${newElements.length} element${newElements.length !== 1 ? "s" : ""} to canvas`
    );
    setIsConverting(false);

    setTimeout(() => {
      onClose();
      setSuccessMsg(null);
    }, 1200);
  }, [code, onClose]);

  const handleConvert = activeTab === "flow" ? handleConvertToFlow : handleConvertToCanvas;

  const handleLoadExample = (key: ExampleKey) => {
    setCode(MERMAID_EXAMPLES[key]);
    setError(null);
    setSuccessMsg(null);
    textareaRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--pd-overlay)",
          zIndex: 190,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: 480,
          background: "var(--pd-surface)",
          borderRight: "1px solid var(--pd-border)",
          boxShadow: "var(--pd-shadow-lg)",
          zIndex: 195,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--pd-border)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "var(--pd-text)",
              }}
            >
              📝 Mermaid → {activeTab === "flow" ? "Flow" : "Canvas"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--pd-text-muted)",
                marginTop: 2,
              }}
            >
              {activeTab === "flow"
                ? "Converts nodes & edges into the Flow canvas"
                : "Paste any Mermaid diagram — it gets placed on the canvas"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--pd-text-muted)",
              fontSize: 18,
              padding: "2px 6px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Example buttons */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 16px",
            borderBottom: "1px solid var(--pd-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--pd-text-subtle)",
              alignSelf: "center",
              marginRight: 4,
            }}
          >
            Examples:
          </span>
          {(["flowchart", "sequence", "er"] as ExampleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleLoadExample(key)}
              style={{
                padding: "3px 10px",
                borderRadius: "var(--pd-radius-full)",
                border: "1px solid var(--pd-border)",
                background: "var(--pd-bg-subtle)",
                color: "var(--pd-text-muted)",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 500,
                textTransform: "capitalize",
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Supported types */}
        <div
          style={{
            padding: "6px 16px",
            borderBottom: "1px solid var(--pd-border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--pd-text-subtle)",
              lineHeight: 1.6,
            }}
          >
            Supports: flowchart · sequence · class · ER · state · gantt · pie ·
            gitGraph · mindmap · C4 · kanban · timeline · sankey · quadrant ·
            xychart · treemap · and more
          </div>
        </div>

        {/* Textarea */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, gap: 12 }}>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
              setSuccessMsg(null);
            }}
            spellCheck={false}
            placeholder={`flowchart TD
    Client[Client] --> LB[Load Balancer]
    LB --> API[API Server]
    API --> DB[(PostgreSQL)]
    API --> Cache[(Redis)]
    Cache --> DB`}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: "var(--pd-radius)",
              border: `1px solid ${error ? "var(--pd-sim-error)" : "var(--pd-border)"}`,
              background: "var(--pd-bg-subtle)",
              color: "var(--pd-text)",
              fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
              fontSize: 12,
              lineHeight: 1.6,
              resize: "none",
              outline: "none",
              transition: "border-color 0.15s",
            }}
          />

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--pd-radius)",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--pd-sim-error)",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              ✗ {error}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--pd-radius)",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "var(--pd-sim-ok)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid var(--pd-border)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "transparent",
              color: "var(--pd-text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={isConverting || !code.trim()}
            style={{
              flex: 2,
              padding: "9px 0",
              borderRadius: "var(--pd-radius)",
              border: "none",
              background:
                isConverting || !code.trim()
                  ? "var(--pd-bg-muted)"
                  : "var(--pd-brand)",
              color:
                isConverting || !code.trim()
                  ? "var(--pd-text-subtle)"
                  : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: isConverting || !code.trim() ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {isConverting
              ? "Converting…"
              : activeTab === "flow"
              ? "Add to Flow →"
              : "Add to Canvas →"}
          </button>
        </div>
      </div>
    </>
  );
}
