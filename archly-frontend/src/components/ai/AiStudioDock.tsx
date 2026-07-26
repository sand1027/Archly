"use client";

/**
 * Unified bottom AI dock — Generate (text→diagram) + Chat (iterate / chaos / explain).
 * Keeps the canvas visible; no centered modal or side drawer.
 */

import { useEffect, useRef, useState, FormEvent, type CSSProperties } from "react";
import { useAiStream } from "@/hooks/useAiStream";
import { useCanvasChat } from "@/hooks/useCanvasChat";
import { useFlowStore } from "@/store/flow.store";
import { useAuth } from "@/providers/auth-provider";
import { convertMermaidToFlow } from "@/lib/mermaid-to-flow";
import ModelSelect from "@/components/ai/ModelSelect";
import ArchitectureLoading from "@/components/ai/ArchitectureLoading";
import {
  readStoredAiProvider,
  storeAiProvider,
  type AiProvider,
} from "@/lib/ai/providers";
import { toast } from "@/store/toast.store";
import type { CanvasKind } from "@/lib/ai/diagram-snapshot";

export type AiDockTab = "generate" | "chat";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tab: AiDockTab;
  onTabChange: (tab: AiDockTab) => void;
  canvas: CanvasKind;
  onPreferFlow?: () => void;
  initialPrompt?: string | null;
  initialProvider?: AiProvider | null;
  autoStart?: boolean;
  /** Dock floats at bottom; sidebar fills the right panel */
  layout?: "dock" | "sidebar";
  onSeedConsumed?: () => void;
}

const GEN_PROMPTS = [
  "Design a Twitter-scale feed",
  "Design a URL shortener",
  "Design Uber ride-sharing",
  "Design Netflix streaming",
];

const CHAT_SUGGESTIONS = [
  "Summarize this architecture",
  "Where are the bottlenecks?",
  "Inject crash on the database",
  "Add a Redis cache in front of the DB",
];

function sanitizeMermaid(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const kw = s.match(/(flowchart|graph)(\s+|$)/i);
  if (kw?.index !== undefined && kw.index > 0) s = s.slice(kw.index).trim();
  return s;
}

export default function AiStudioDock({
  isOpen,
  onClose,
  tab,
  onTabChange,
  canvas,
  onPreferFlow,
  initialPrompt,
  initialProvider,
  autoStart,
  layout = "dock",
  onSeedConsumed,
}: Props) {
  if (!isOpen) return null;

  const isSidebar = layout === "sidebar";

  return (
    <div
      className="ai-studio-dock"
      role="dialog"
      aria-label="Archly AI"
      style={
        isSidebar
          ? {
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              background: "var(--pd-surface)",
              overflow: "hidden",
            }
          : {
              position: "fixed",
              left: "50%",
              bottom: "calc(16px + var(--ai-dock-lift, 0px))",
              transform: "translateX(-50%)",
              zIndex: 220,
              width: "min(720px, calc(100vw - 24px))",
              maxHeight: "min(46vh, 420px)",
              display: "flex",
              flexDirection: "column",
              background: "var(--pd-surface)",
              border: "1px solid var(--pd-border)",
              borderRadius: "var(--pd-radius-lg)",
              boxShadow: "var(--pd-shadow-lg)",
              overflow: "hidden",
              animation: "slide-in-up 180ms var(--pd-ease)",
            }
      }
    >
      {/* Header + tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: isSidebar ? "8px 10px" : "8px 12px",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
          background: "var(--pd-sidebar-bg)",
        }}
      >
        {!isSidebar && (
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--pd-brand)" }}>AI</span>
        )}
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 2,
            borderRadius: "var(--pd-radius-full)",
            background: "var(--pd-bg-muted)",
            flex: isSidebar ? 1 : undefined,
          }}
        >
          {(
            [
              { id: "generate" as const, label: "Generate" },
              { id: "chat" as const, label: "Chat" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              style={{
                flex: isSidebar ? 1 : undefined,
                padding: "5px 12px",
                borderRadius: "var(--pd-radius-full)",
                border: "none",
                background: tab === t.id ? "var(--pd-surface)" : "transparent",
                color: tab === t.id ? "var(--pd-brand)" : "var(--pd-text-muted)",
                fontSize: 12,
                fontWeight: tab === t.id ? 700 : 600,
                cursor: "pointer",
                boxShadow: tab === t.id ? "var(--pd-shadow-sm)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {!isSidebar && (
          <>
            <span style={{ flex: 1, fontSize: 11, color: "var(--pd-text-subtle)", minWidth: 0 }}>
              {tab === "generate"
                ? "Describe a system → Mermaid on Flow"
                : "Ask, inject chaos, or add nodes"}
            </span>
            <button type="button" onClick={onClose} title="Close" style={iconBtn}>
              ✕
            </button>
          </>
        )}
      </div>

      {tab === "generate" ? (
        <GeneratePane
          onPreferFlow={onPreferFlow}
          initialPrompt={initialPrompt}
          initialProvider={initialProvider}
          autoStart={autoStart}
          onDoneSwitchToChat={() => {
            onTabChange("chat");
            onSeedConsumed?.();
          }}
          compact={isSidebar}
        />
      ) : (
        <ChatPane canvas={canvas} />
      )}
    </div>
  );
}

// ─── Generate ─────────────────────────────────────────────────────────────

function GeneratePane({
  onPreferFlow,
  initialPrompt,
  initialProvider,
  autoStart,
  onDoneSwitchToChat,
  compact,
}: {
  onPreferFlow?: () => void;
  initialPrompt?: string | null;
  initialProvider?: AiProvider | null;
  autoStart?: boolean;
  onDoneSwitchToChat: () => void;
  compact?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProvider>("groq");
  const { isAuthenticated } = useAuth();
  const providerRef = useRef<AiProvider>("groq");
  const autoStartedRef = useRef(false);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    queueMicrotask(() => setProvider(readStoredAiProvider()));
  }, []);

  useEffect(() => {
    if (initialProvider) {
      setProvider(initialProvider);
      storeAiProvider(initialProvider);
    }
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt, initialProvider]);

  const { stream, cancel, isStreaming, error } = useAiStream({
    onDone: async (fullResponse) => {
      const cleaned = sanitizeMermaid(fullResponse);
      setStatusMsg("Converting…");
      const result = await convertMermaidToFlow(cleaned);
      if (!result.ok) {
        setStatusMsg("Invalid diagram — try rephrasing.");
        return;
      }
      const { nodes, edges } = result;
      const { nodes: existing, edges: existingEdges } = useFlowStore.getState();
      const existingNodeIds = new Set(existing.map((n) => n.id));
      const existingEdgeKeys = new Set(
        existingEdges.map((e) => `${e.source}->${e.target}`)
      );
      const offsetX =
        existing.length > 0
          ? Math.max(...existing.map((n) => n.position.x)) + 240
          : 0;
      const newNodes = nodes
        .filter((n) => !existingNodeIds.has(n.id))
        .map((n) => ({ ...n, position: { x: n.position.x + offsetX, y: n.position.y } }));
      const newEdges = edges.filter(
        (e) => !existingEdgeKeys.has(`${e.source}->${e.target}`)
      );
      onPreferFlow?.();
      useFlowStore.setState((s) => ({
        nodes: [...s.nodes, ...newNodes],
        edges: [...s.edges, ...newEdges],
      }));
      useFlowStore.getState().requestFitView();
      setStatusMsg(`✓ ${newNodes.length} nodes on Flow`);
      toast(`Diagram ready — open Chat to iterate`, "success");
      setTimeout(() => {
        setStatusMsg(null);
        onDoneSwitchToChat();
      }, 900);
    },
  });

  const handleSubmit = () => {
    if (!prompt.trim() || isStreaming) return;
    setStatusMsg(null);
    setActivePrompt(prompt.trim());
    onPreferFlow?.();
    stream(prompt.trim(), providerRef.current);
  };

  useEffect(() => {
    if (!autoStart || !initialPrompt || autoStartedRef.current || isStreaming) return;
    autoStartedRef.current = true;
    const p = initialPrompt.trim();
    if (!p) return;
    setPrompt(p);
    setActivePrompt(p);
    const prov = initialProvider ?? providerRef.current;
    if (initialProvider) providerRef.current = initialProvider;
    onPreferFlow?.();
    stream(p, prov);
  }, [autoStart, initialPrompt, initialProvider, isStreaming, stream, onPreferFlow]);

  useEffect(() => {
    if (!error) return;
    const msg = typeof error === "string" ? error : error.message;
    if (/quota|too many|rate/i.test(msg)) {
      toast("AI quota exceeded — switch provider", "error", 4500);
    }
  }, [error]);

  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflowY: "auto",
        minHeight: 0,
        flex: 1,
      }}
    >
      {!isAuthenticated && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "var(--pd-radius)",
            background: "var(--pd-brand-subtle)",
            color: "var(--pd-brand-text)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Sign up to save and share diagrams.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(compact ? GEN_PROMPTS.slice(0, 3) : GEN_PROMPTS).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrompt(p)}
            style={chipStyle(prompt === p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div
        style={{
          borderRadius: "var(--pd-radius)",
          border: "1px solid var(--pd-border)",
          background: "var(--pd-bg-subtle)",
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder="Describe your system… (⌘+Enter)"
          rows={2}
          style={{
            display: "block",
            width: "100%",
            padding: "10px 12px 4px",
            border: "none",
            background: "transparent",
            color: "var(--pd-text)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "4px 8px 8px",
          }}
        >
          <ModelSelect value={provider} onChange={setProvider} disabled={isStreaming} />
          {isStreaming ? (
            <button type="button" onClick={cancel} style={sendBtn}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              style={{
                ...sendBtn,
                opacity: prompt.trim() ? 1 : 0.45,
                cursor: prompt.trim() ? "pointer" : "not-allowed",
              }}
            >
              Generate
            </button>
          )}
        </div>
      </div>

      {isStreaming && (
        <ArchitectureLoading active hint={activePrompt} />
      )}

      {!isStreaming && statusMsg && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--pd-brand)",
          }}
        >
          {statusMsg}
        </div>
      )}

      {error && !isStreaming && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--pd-sim-error)",
          }}
        >
          {typeof error === "string" ? error : error.message}
        </div>
      )}
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────

function ChatPane({ canvas }: { canvas: CanvasKind }) {
  const { messages, isStreaming, error, send, cancel, clear, selectionHint } =
    useCanvasChat({ canvas, enabled: true });
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<AiProvider>("groq");
  const listRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<AiProvider>("groq");

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    queueMicrotask(() => setProvider(readStoredAiProvider()));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input, providerRef.current);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {selectionHint && (
        <div
          style={{
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--pd-brand)",
            background: "color-mix(in srgb, var(--pd-brand) 8%, transparent)",
            borderBottom: "1px solid var(--pd-border)",
          }}
        >
          {selectionHint}
        </div>
      )}

      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 120,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--pd-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
            Diagram is on the canvas — ask questions, add nodes, or inject chaos.
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {CHAT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s, providerRef.current)}
                  style={chipStyle(false)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
            }}
          >
            <div
              style={{
                padding: "7px 10px",
                borderRadius: 12,
                fontSize: 12.5,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: m.role === "user" ? "var(--pd-brand)" : "var(--pd-bg-muted)",
                color: m.role === "user" ? "#fff" : "var(--pd-text)",
              }}
            >
              {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
            </div>
            {m.actionResults && m.actionResults.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {m.actionResults.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "var(--pd-radius-full)",
                      background: r.ok
                        ? "color-mix(in srgb, #16a34a 14%, transparent)"
                        : "color-mix(in srgb, #dc2626 14%, transparent)",
                      color: r.ok ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {r.message}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: "4px 12px", fontSize: 11, color: "#dc2626" }}>{error}</div>
      )}

      <form
        onSubmit={onSubmit}
        style={{
          padding: "8px 10px",
          borderTop: "1px solid var(--pd-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
          placeholder="Ask, add a service, or inject chaos…"
          rows={2}
          disabled={isStreaming}
          style={{
            width: "100%",
            resize: "none",
            fontSize: 12.5,
            padding: "8px 10px",
            borderRadius: "var(--pd-radius)",
            border: "1px solid var(--pd-border)",
            background: "var(--pd-bg)",
            color: "var(--pd-text)",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <ModelSelect value={provider} onChange={setProvider} disabled={isStreaming} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={clear} style={iconBtn} title="Clear chat">
              Clear
            </button>
            {isStreaming ? (
              <button type="button" onClick={cancel} style={sendBtn}>
                Stop
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} style={sendBtn}>
                Send
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function chipStyle(active: boolean): CSSProperties {
  return {
    fontSize: 11,
    padding: "4px 9px",
    borderRadius: "var(--pd-radius-full)",
    border: "1px solid var(--pd-border)",
    background: active ? "var(--pd-brand-subtle)" : "var(--pd-bg-muted)",
    color: active ? "var(--pd-brand)" : "var(--pd-text)",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
  };
}

const iconBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
};

const sendBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: "var(--pd-radius)",
  border: "none",
  background: "var(--pd-brand)",
  color: "#fff",
  cursor: "pointer",
  flexShrink: 0,
};
