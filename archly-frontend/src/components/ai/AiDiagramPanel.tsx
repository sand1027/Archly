"use client";

import { useState, useCallback, useRef } from "react";
import { useAiStream } from "@/hooks/useAiStream";
import { useCanvasStore } from "@/store/canvas.store";
import { useFlowStore } from "@/store/flow.store";
import { useAuth } from "@/providers/auth-provider";
import { convertMermaidToCanvas } from "@/lib/mermaid-to-canvas";
import { convertMermaidToFlow } from "@/lib/mermaid-to-flow";
import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import type { ExcalidrawElement } from "@/types";

// Lazily resolved — same pattern as MermaidEditor
let _convertToExcalidrawElements: ((els: unknown[]) => ExcalidrawElement[]) | null = null;
async function getConverter() {
  if (_convertToExcalidrawElements) return _convertToExcalidrawElements;
  const mod = await import("@excalidraw/excalidraw");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _convertToExcalidrawElements = (mod as any).convertToExcalidrawElements;
  return _convertToExcalidrawElements;
}

/**
 * Sanitize Mermaid output from Gemini streaming.
 *
 * Uses targeted line-by-line repairs rather than aggressive reconstruction.
 * Fixes only specific known patterns without destroying valid syntax.
 */
function sanitizeMermaid(raw: string): string {
  let s = raw.trim();

  // 1. Strip markdown code fences
  s = s.replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // 2. Strip preamble before first diagram keyword
  const diagramKeywords = ["flowchart","graph","sequenceDiagram","classDiagram",
    "erDiagram","stateDiagram","gantt","pie","gitGraph","mindmap","timeline","C4Context","kanban"];
  const kwMatch = s.match(new RegExp(`(${diagramKeywords.join("|")})(\\s+|$)`, "i"));
  if (kwMatch?.index !== undefined && kwMatch.index > 0) {
    s = s.slice(kwMatch.index).trim();
  }

  // 3. Line-by-line: merge continuation lines into their parent.
  //    A line is a CONTINUATION of the previous if it starts with characters
  //    that cannot begin a new Mermaid statement on their own:
  //      - starts with '[' or '(' → orphaned label: "NodeId\n[Label]"
  //      - starts with '|' → orphaned pipe label closer: "-->|label\n|"
  //      - previous line ended inside a pipe label "|...<no closing |>"
  //      - previous line ends with dangling '-->' or '--'
  const rawLines = s.split("\n");
  const merged: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      merged.push(line);
      continue;
    }

    // Is this line a continuation of the previous non-empty line?
    const prev = merged[merged.length - 1] ?? "";
    const prevTrimmed = prev.trim();

    const prevEndsWithArrow = /--[->]\s*$/.test(prevTrimmed);
    const prevOpenPipe = (prevTrimmed.match(/\|/g) ?? []).length % 2 === 1; // odd = unclosed pipe
    const lineStartsWithLabel = /^\[|\^\(|\^\[\(/.test(trimmed) || trimmed.startsWith("[") || trimmed.startsWith("(") || trimmed.startsWith("[(");
    const lineStartsWithPipeClose = trimmed.startsWith("|");
    const prevEndsWithWordChar = /[A-Za-z0-9_]$/.test(prevTrimmed);
    const lineIsWordOnly = /^[A-Za-z0-9_][A-Za-z0-9_ ]*$/.test(trimmed) && !trimmed.includes("-->") && !trimmed.includes("---");
    // Split node ID: prev line ends with "X --> PARTIAL" where PARTIAL is a bare word
    // e.g. prev="LB --> AP", current="IGWW[API Gateway]" → "LB --> APIGWW[API Gateway]"
    const prevIsHeader = /^(?:flowchart|graph)\s+(?:TD|LR|RL|BT|TB)$/i.test(prevTrimmed);
    const prevHasArrowAndBareEnd = prevEndsWithWordChar &&
      prevTrimmed.includes("-->") &&          // has an arrow (so it's a statement)
      !/[\[\](){}]/.test(prevTrimmed) &&      // no brackets — target node ID is incomplete
      !prevIsHeader;
    const lineIsSplitNodeId = /^[A-Za-z0-9_]+[\[({]/.test(trimmed) && prevHasArrowAndBareEnd;

    const isContinuation =
      (!prevIsHeader) && (
        prevEndsWithArrow ||
        prevOpenPipe ||
        lineStartsWithLabel ||
        lineStartsWithPipeClose ||
        lineIsSplitNodeId ||
        (prevEndsWithWordChar && lineIsWordOnly && merged.length > 0)
      );

    if (isContinuation && merged.length > 0) {
      // No space before labels [...] or split node IDs — they attach directly to the previous token
      const joiner = (lineStartsWithLabel || lineIsSplitNodeId) ? "" : " ";
      merged[merged.length - 1] = prev.trimEnd() + joiner + trimmed;
    } else {
      merged.push(line);
    }
  }

  s = merged.join("\n");

  // 4. Remove subgraph blocks — @excalidraw/mermaid-to-excalidraw throws
  //    "SubGraph element not found" for them. Strip the subgraph wrapper but
  //    keep the node/edge lines inside so the diagram still renders.
  const subgraphStripped: string[] = [];
  let inSubgraph = false;
  for (const line of merged) {
    const t = line.trim();
    if (/^subgraph\b/i.test(t)) { inSubgraph = true; continue; }
    if (/^end\s*$/i.test(t) && inSubgraph) { inSubgraph = false; continue; }
    subgraphStripped.push(line);
  }
  s = subgraphStripped.join("\n");

  // 5. Clean special chars from node labels in [...] and (...)
  s = s.replace(/\[([^\]]*)\]/g, (_m, inner) =>
    `[${inner.replace(/[\/\\|&%#@:;,'"]/g, " ").replace(/\s{2,}/g, " ").trim()}]`
  );
  s = s.replace(/\(([^)]*)\)/g, (_m, inner) =>
    `(${inner.replace(/[\/\\|&%#@:;,'"]/g, " ").replace(/\s{2,}/g, " ").trim()})`
  );

  return s.trim();
}

interface AiDiagramPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROMPTS = [
  "Design a Twitter-scale feed for 100M users",
  "Design a URL shortener like bit.ly",
  "Design a real-time chat app",
  "Design a ride-sharing service like Uber",
  "Design a video streaming platform",
  "Design a notification system at 10M/day",
];

export default function AiDiagramPanel({ isOpen, onClose }: AiDiagramPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [target, setTarget] = useState<"canvas" | "flow">("canvas");
  const [provider, setProvider] = useState<"ollama" | "openrouter">("ollama");
  const { isAuthenticated } = useAuth();
  const targetRef = useRef<"canvas" | "flow">("canvas");
  targetRef.current = target;
  const providerRef = useRef<"ollama" | "openrouter">("ollama");
  providerRef.current = provider;

  const { stream, cancel, isStreaming, response, error } = useAiStream({
    onDone: async (fullResponse) => {
      const cleaned = sanitizeMermaid(fullResponse);
      setStatusMsg("Converting to diagram…");

      // ── Flow target ──────────────────────────────────────────────────
      if (targetRef.current === "flow") {
        const result = await convertMermaidToFlow(cleaned);
        if (!result.ok) {
          setStatusMsg("AI returned an invalid diagram. Try rephrasing your prompt.");
          return;
        }
        const { nodes, edges } = result;
        if (nodes.length === 0) {
          setStatusMsg("AI returned an invalid diagram. Try rephrasing your prompt.");
          return;
        }
        const { nodes: existing, edges: existingEdges } = useFlowStore.getState();
        const existingNodeIds = new Set(existing.map((n: { id: string }) => n.id));
        const existingEdgeKeys = new Set(
          existingEdges.map((e: { source: string; target: string }) => `${e.source}->${e.target}`)
        );
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
        setStatusMsg(`✓ Added ${newNodes.length} nodes to Flow canvas`);
        setTimeout(() => { setStatusMsg(null); onClose(); }, 1500);
        return;
      }

      // ── Canvas (Excalidraw) target ────────────────────────────────────
      const result = await convertMermaidToCanvas(cleaned);
      if (!result.ok) {
        setStatusMsg("AI returned an invalid diagram. Try rephrasing your prompt.");
        return;
      }

      const converter = await getConverter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newElements: ExcalidrawElement[] = converter
        ? (converter(result.data.elements) as ExcalidrawElement[])
        : result.data.elements as ExcalidrawElement[];

      if (newElements.length === 0) {
        setStatusMsg("AI returned an invalid diagram. Try rephrasing your prompt.");
        return;
      }

      const api = getExcalidrawAPI();
      if (api) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = api.getSceneElements() as any[];
        const existingIds = new Set(current.map((e: { id: string }) => e.id));
        const toAdd = newElements.filter((e) => !existingIds.has(e.id));
        api.updateScene({ elements: [...current, ...toAdd] });
        setTimeout(() => api.scrollToContent?.(), 80);
      } else {
        const { elements: storeEls, setElements } = useCanvasStore.getState();
        const existingIds = new Set(storeEls.map((e) => e.id));
        const toAdd = newElements.filter((e) => !existingIds.has(e.id));
        setElements([...storeEls, ...toAdd]);
      }

      setStatusMsg(`✓ Added ${newElements.length} elements to canvas`);
      setTimeout(() => { setStatusMsg(null); onClose(); }, 1500);
    },
  });

  const handleSubmit = useCallback(() => {
    if (!prompt.trim() || isStreaming) return;
    setStatusMsg(null);
    setActivePrompt(prompt.trim());
    stream(prompt.trim(), providerRef.current);
  }, [prompt, isStreaming, stream]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--pd-overlay)",
          zIndex: 190,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 195,
          width: 520,
          background: "var(--pd-surface)",
          border: "1px solid var(--pd-border)",
          borderRadius: "var(--pd-radius-xl)",
          boxShadow: "var(--pd-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom: "1px solid var(--pd-border)",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--pd-text)" }}>
              ✨ AI Text-to-Diagram
            </div>
            <div style={{ fontSize: 11, color: "var(--pd-text-muted)", marginTop: 2 }}>
              Describe your architecture — diagram appears on canvas
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
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Sign-up nudge */}
          {!isAuthenticated && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--pd-radius)",
              background: "var(--pd-brand-subtle)",
              color: "var(--pd-brand-text)",
              fontSize: 12,
              fontWeight: 600,
            }}>
              Sign up to save and share your diagrams.
            </div>
          )}

          {/* Target selector */}
          <div style={{
            display: "flex",
            gap: 6,
            padding: "2px",
            background: "var(--pd-bg-muted)",
            borderRadius: "var(--pd-radius)",
          }}>
            {(["canvas", "flow"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: "calc(var(--pd-radius) - 2px)",
                  border: "none",
                  background: target === t ? "var(--pd-surface)" : "transparent",
                  color: target === t ? "var(--pd-text)" : "var(--pd-text-muted)",
                  fontSize: 12,
                  fontWeight: target === t ? 700 : 500,
                  cursor: "pointer",
                  boxShadow: target === t ? "var(--pd-shadow-sm)" : "none",
                  transition: "all 120ms",
                }}
              >
                {t === "canvas" ? "✏️ Canvas" : "⬡ Flow"}
              </button>
            ))}
          </div>

          {/* AI provider selector */}
          <div style={{
            display: "flex",
            gap: 6,
            padding: "2px",
            background: "var(--pd-bg-muted)",
            borderRadius: "var(--pd-radius)",
          }}>
            {([
              { key: "ollama", label: "🏠 Archly AI", hint: "Local model — fast, private, no quota" },
              { key: "openrouter", label: "☁️ Cloud AI", hint: "OpenRouter — more detailed output" },
            ] as const).map(({ key, label, hint }) => (
              <button
                key={key}
                onClick={() => setProvider(key)}
                title={hint}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: "calc(var(--pd-radius) - 2px)",
                  border: "none",
                  background: provider === key ? "var(--pd-surface)" : "transparent",
                  color: provider === key ? "var(--pd-brand)" : "var(--pd-text-muted)",
                  fontSize: 12,
                  fontWeight: provider === key ? 700 : 500,
                  cursor: "pointer",
                  boxShadow: provider === key ? "var(--pd-shadow-sm)" : "none",
                  transition: "all 120ms",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Example prompts */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--pd-radius-full)",
                  border: "1px solid var(--pd-border)",
                  background:
                    prompt === p ? "var(--pd-brand-subtle)" : "var(--pd-bg-subtle)",
                  color:
                    prompt === p ? "var(--pd-brand)" : "var(--pd-text-muted)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: prompt === p ? 700 : 400,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Prompt input */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            placeholder="Describe your system architecture…  (⌘+Enter to generate)"
            rows={3}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "var(--pd-bg-subtle)",
              color: "var(--pd-text)",
              fontSize: 13,
              fontFamily: "Assistant, sans-serif",
              lineHeight: 1.5,
              resize: "vertical",
              outline: "none",
            }}
          />

          {/* Streaming preview — bordered card with prompt label */}
          {(isStreaming || (response && !statusMsg)) && activePrompt && (
            <div
              style={{
                position: "relative",
                border: "1.5px solid var(--pd-brand)",
                borderRadius: "var(--pd-radius)",
                padding: "18px 12px 10px",
                background: "var(--pd-bg-muted)",
              }}
            >
              {/* Prompt label badge */}
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: 10,
                  background: "var(--pd-brand)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "var(--pd-radius-full)",
                  maxWidth: "calc(100% - 24px)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: "0.02em",
                }}
                title={activePrompt}
              >
                ✨ {activePrompt}
              </div>

              {/* Mermaid stream output */}
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--pd-text-muted)",
                  maxHeight: 120,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.55,
                }}
                className="scrollbar-hide"
              >
                {response}
                {isStreaming && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 12,
                      background: "var(--pd-brand)",
                      marginLeft: 2,
                      animation: "packet-pulse 0.8s ease-in-out infinite",
                    }}
                  />
                )}
              </div>

              {/* Streaming indicator row */}
              {isStreaming && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  fontSize: 10,
                  color: "var(--pd-brand)",
                  fontWeight: 600,
                }}>
                  <span style={{ animation: "packet-pulse 1s ease-in-out infinite" }}>●</span>
                  Generating…
                </div>
              )}
            </div>
          )}

          {/* Status / error */}
          {statusMsg && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: statusMsg.startsWith("✓")
                  ? "var(--pd-sim-ok)"
                  : "var(--pd-sim-error)",
              }}
            >
              {statusMsg}
            </div>
          )}
          {error && !statusMsg && (
            <div style={{ fontSize: 12, color: "var(--pd-sim-error)" }}>
              {error.message}
            </div>
          )}

          {/* no upgrade upsell — everything is free */}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "0 18px 18px",
          }}
        >
          {isStreaming ? (
            <button
              onClick={cancel}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: "var(--pd-radius)",
                border: "1px solid var(--pd-border)",
                background: "transparent",
                color: "var(--pd-sim-error)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⏹ Stop
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px 0",
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
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  borderRadius: "var(--pd-radius)",
                  border: "none",
                  background: !prompt.trim() ? "var(--pd-bg-muted)" : "var(--pd-brand)",
                  color: !prompt.trim() ? "var(--pd-text-subtle)" : "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: !prompt.trim() ? "not-allowed" : "pointer",
                }}
              >
                ✨ Generate → {target === "flow" ? "Flow" : "Canvas"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
