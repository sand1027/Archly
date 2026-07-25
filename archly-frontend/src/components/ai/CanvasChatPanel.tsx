"use client";

import { useEffect, useRef, useState, FormEvent, type CSSProperties } from "react";
import { useCanvasChat } from "@/hooks/useCanvasChat";
import type { CanvasKind } from "@/lib/ai/diagram-snapshot";
import ModelSelect from "@/components/ai/ModelSelect";
import { readStoredAiProvider, type AiProvider } from "@/lib/ai/providers";

interface CanvasChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: CanvasKind;
}

const SUGGESTIONS = [
  "What does the selected node do?",
  "Summarize this architecture",
  "Inject crash on the database",
  "Add slow latency to the API gateway",
  "Clear all chaos",
];

export default function CanvasChatPanel({ isOpen, onClose, canvas }: CanvasChatPanelProps) {
  const { messages, isStreaming, error, send, cancel, clear, selectionHint } =
    useCanvasChat({ canvas, enabled: isOpen });
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<AiProvider>("openrouter");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const providerRef = useRef<AiProvider>("openrouter");

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    queueMicrotask(() => setProvider(readStoredAiProvider()));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const assistantNotes = messages
    .filter((message) => message.role === "assistant" && message.content.trim())
    .map((message) => message.content.trim());

  const exportNotes = () => {
    if (assistantNotes.length === 0) return;
    const content = `# Archly architecture notes\n\n${assistantNotes.join("\n\n---\n\n")}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `archly-notes-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input, providerRef.current);
    setInput("");
  };

  return (
    <aside
      role="dialog"
      aria-label="Architecture chat"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(380px, 100%)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        background: "var(--pd-surface-raised)",
        borderLeft: "1px solid var(--pd-border)",
        boxShadow: "var(--pd-shadow)",
        animation: "fade-in 160ms ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16 }}>💬</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pd-text)" }}>
            Architecture Chat
          </div>
          <div style={{ fontSize: 11, color: "var(--pd-text-muted)" }}>
            Explain nodes · inject chaos · {canvas === "flow" ? "Flow" : "Canvas"}
          </div>
        </div>
        <button
          type="button"
          onClick={exportNotes}
          disabled={assistantNotes.length === 0}
          title="Download assistant messages as Markdown"
          style={{
            ...iconBtn,
            opacity: assistantNotes.length === 0 ? 0.45 : 1,
            cursor: assistantNotes.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Export notes
        </button>
        <button
          type="button"
          onClick={clear}
          title="Clear chat"
          style={iconBtn}
        >
          Clear
        </button>
        <button type="button" onClick={onClose} title="Close" style={iconBtn}>
          ✕
        </button>
      </div>

      {selectionHint && (
        <div
          style={{
            padding: "6px 14px",
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

      {/* Messages */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--pd-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
            Ask about any node, or tell me to run a chaos experiment.
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s, providerRef.current)}
                  style={{
                    fontSize: 11,
                    padding: "5px 9px",
                    borderRadius: "var(--pd-radius-full)",
                    border: "1px solid var(--pd-border)",
                    background: "var(--pd-bg-muted)",
                    color: "var(--pd-text)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
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
              maxWidth: "92%",
            }}
          >
            <div
              style={{
                padding: "8px 11px",
                borderRadius: 12,
                fontSize: 12.5,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background:
                  m.role === "user"
                    ? "var(--pd-brand)"
                    : "var(--pd-bg-muted)",
                color: m.role === "user" ? "#fff" : "var(--pd-text)",
              }}
            >
              {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
            </div>
            {m.actionResults && m.actionResults.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {m.actionResults.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "var(--pd-radius-full)",
                      background: r.ok
                        ? "color-mix(in srgb, #16a34a 14%, transparent)"
                        : "color-mix(in srgb, #dc2626 14%, transparent)",
                      color: r.ok ? "#16a34a" : "#dc2626",
                      border: `1px solid ${r.ok ? "#16a34a33" : "#dc262633"}`,
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
        <div
          style={{
            padding: "6px 14px",
            fontSize: 11,
            color: "#dc2626",
            borderTop: "1px solid var(--pd-border)",
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={onSubmit}
        style={{
          padding: 12,
          borderTop: "1px solid var(--pd-border)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: "var(--pd-radius)",
            border: "1px solid var(--pd-border)",
            background: "var(--pd-bg)",
            minWidth: 0,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder="Ask about a node or inject chaos…"
            rows={2}
            disabled={isStreaming}
            style={{
              display: "block",
              width: "100%",
              resize: "none",
              fontSize: 12.5,
              padding: "8px 10px 4px",
              border: "none",
              background: "transparent",
              color: "var(--pd-text)",
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <div style={{ padding: "3px 6px 6px" }}>
            <ModelSelect
              value={provider}
              onChange={setProvider}
              disabled={isStreaming}
            />
          </div>
        </div>
        {isStreaming ? (
          <button type="button" onClick={cancel} style={sendBtn}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} style={sendBtn}>
            Send
          </button>
        )}
      </form>
    </aside>
  );
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
  padding: "8px 12px",
  borderRadius: "var(--pd-radius)",
  border: "none",
  background: "var(--pd-brand)",
  color: "#fff",
  cursor: "pointer",
  flexShrink: 0,
};
