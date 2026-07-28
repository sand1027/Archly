"use client";

/**
 * Schema AI Generate panel — streams erDiagram and loads schema store.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAiStream } from "@/hooks/useAiStream";
import { useSchemaStore } from "@/store/schema.store";
import ModelSelect from "@/components/ai/ModelSelect";
import ArchitectureLoading from "@/components/ai/ArchitectureLoading";
import {
  readStoredAiProvider,
  storeAiProvider,
  type AiProvider,
} from "@/lib/ai/providers";
import { convertErDiagramToSchema, extractErDiagram } from "@/lib/schema/er-to-schema";
import { looksLikeSchemaIncremental } from "@/lib/schema/schema-edges";
import { toast } from "@/store/toast.store";
import { SCHEMA_EXAMPLES } from "./SchemaEmptyHero";
import { architectureForThisSchemaPrompt } from "@/lib/schema/cross-prompts";
import { useSchemaExplain } from "@/hooks/useSchemaExplain";

const ADD_EXAMPLES = [
  {
    id: "add-payments",
    label: "+ Payments table",
    prompt: "Add a payments table with order_id FK, amount_cents, provider, status, and created_at",
  },
  {
    id: "add-sessions",
    label: "+ Sessions table",
    prompt: "Add a sessions table linked to users with token_hash, expires_at, and ip",
  },
  {
    id: "add-audit",
    label: "+ Audit logs",
    prompt: "Add an audit_logs table with actor_id FK to users, action, entity_type, entity_id, meta jsonb",
  },
] as const;

interface Props {
  initialPrompt?: string | null;
  initialProvider?: AiProvider | null;
  autoStart?: boolean;
  onSeedConsumed?: () => void;
  /** Jump to Design AI and generate architecture from this schema */
  onArchitectureForThis?: (prompt: string, provider: AiProvider) => void;
}

export default function SchemaAiPanel({
  initialPrompt,
  initialProvider,
  autoStart,
  onSeedConsumed,
  onArchitectureForThis,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<AiProvider>("groq");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const seeded = useRef(false);
  const lastPromptRef = useRef("");
  const setGraph = useSchemaStore((s) => s.setGraph);
  const tableCount = useSchemaStore((s) => s.nodes.length);
  const schemaNodes = useSchemaStore((s) => s.nodes);
  const schemaEdges = useSchemaStore((s) => s.edges);
  const { text: explainText, isStreaming: explaining, explainFullSchema, cancel: cancelExplain } = useSchemaExplain();

  const { stream, cancel, isStreaming, error } = useAiStream({
    onDone: (full) => {
      const er = extractErDiagram(full);
      if (!er) {
        toast("AI did not return an erDiagram — try again", "error");
        return;
      }
      const result = convertErDiagramToSchema(er);
      if ("error" in result) {
        toast(result.error, "error");
        return;
      }
      const existing = useSchemaStore.getState().nodes.length;
      const merge =
        existing > 0 && looksLikeSchemaIncremental(lastPromptRef.current);
      setGraph(result.nodes, result.edges, { merge });
      const msg = merge
        ? `Merged into schema · ${result.nodes.length} table(s) from AI`
        : `Loaded ${result.nodes.length} tables · ${result.edges.length} relations`;
      setStatusMsg(msg);
      toast(merge ? "Table(s) added to schema" : `Schema ready — ${result.nodes.length} tables`, "success");
    },
  });

  useEffect(() => {
    setProvider(readStoredAiProvider("groq"));
  }, []);

  useEffect(() => {
    if (seeded.current) return;
    if (!initialPrompt) return;
    seeded.current = true;
    setPrompt(initialPrompt);
    const p = initialProvider ?? readStoredAiProvider("groq");
    setProvider(p);
    if (autoStart) {
      lastPromptRef.current = initialPrompt;
      stream(initialPrompt, p, "schema");
    }
    onSeedConsumed?.();
  }, [initialPrompt, initialProvider, autoStart, stream, onSeedConsumed]);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setStatusMsg(null);
    lastPromptRef.current = trimmed;
    storeAiProvider(provider);
    stream(trimmed, provider, "schema");
  };

  const submit = () => run(prompt);

  const runArchitectureForThis = () => {
    const { nodes, edges } = useSchemaStore.getState();
    const built = architectureForThisSchemaPrompt(nodes, edges);
    if (!built) {
      toast("Add tables first, then generate architecture for this schema", "error");
      return;
    }
    storeAiProvider(provider);
    onArchitectureForThis?.(built, provider);
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        overflow: "auto",
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pd-text)", marginBottom: 4 }}>
          Schema AI
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "var(--pd-text-subtle)", lineHeight: 1.4 }}>
          Targets 30–40 tables with relationships. “Add a payments table…” merges into an
          existing schema and wires FKs.
        </p>
      </div>

      {tableCount > 0 && onArchitectureForThis && (
        <button
          type="button"
          onClick={runArchitectureForThis}
          disabled={isStreaming || explaining}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid color-mix(in srgb, var(--pd-brand) 40%, var(--pd-border))",
            background: "color-mix(in srgb, var(--pd-brand) 14%, var(--pd-surface))",
            color: "var(--pd-text)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: isStreaming || explaining ? "not-allowed" : "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span>Architecture for this schema</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--pd-text-subtle)" }}>
            One click → system design from {tableCount} table{tableCount === 1 ? "" : "s"}
          </span>
        </button>
      )}

      {tableCount > 0 && (
        <button
          type="button"
          onClick={() => explainFullSchema(schemaNodes, schemaEdges, provider)}
          disabled={isStreaming || explaining}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--pd-border)",
            background: "var(--pd-bg-subtle)",
            color: "var(--pd-text)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: isStreaming || explaining ? "not-allowed" : "pointer",
            textAlign: "left",
          }}
        >
          {explaining ? "Explaining schema…" : "Explain entire schema (AI)"}
        </button>
      )}

      {explainText && (
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--pd-text)",
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--pd-border)",
            background: "var(--pd-bg-subtle)",
            whiteSpace: "pre-wrap",
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {explainText}
          {explaining && (
            <button type="button" onClick={cancelExplain} style={{ display: "block", marginTop: 8, fontSize: 11 }}>
              Stop
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SCHEMA_EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => {
              setPrompt(ex.prompt);
              run(ex.prompt);
            }}
            style={chip(prompt === ex.prompt)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pd-text-subtle)" }}>
        Add to current schema
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ADD_EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => {
              setPrompt(ex.prompt);
              run(ex.prompt);
            }}
            style={chip(prompt === ex.prompt)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div
        style={{
          borderRadius: 8,
          border: "1px solid var(--pd-border)",
          background: "var(--pd-bg-subtle)",
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder='e.g. Add a notifications table with user_id FK…'
          rows={3}
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
          <ModelSelect
            value={provider}
            onChange={(p) => {
              setProvider(p);
              storeAiProvider(p);
            }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button type="button" onClick={cancel} style={btn}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!prompt.trim()}
              style={{
                ...btn,
                opacity: prompt.trim() ? 1 : 0.45,
                cursor: prompt.trim() ? "pointer" : "not-allowed",
              }}
            >
              Generate
            </button>
          )}
        </div>
      </div>

      {isStreaming && <ArchitectureLoading active hint={prompt} />}
      {!isStreaming && statusMsg && (
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pd-brand)" }}>{statusMsg}</div>
      )}
      {error && !isStreaming && (
        <div style={{ fontSize: 12, color: "var(--pd-sim-error)" }}>{error.message}</div>
      )}
    </div>
  );
}

function chip(active: boolean): CSSProperties {
  return {
    fontSize: 11,
    padding: "4px 9px",
    borderRadius: 999,
    border: "1px solid var(--pd-border)",
    background: active ? "var(--pd-brand-subtle)" : "var(--pd-bg-muted)",
    color: active ? "var(--pd-brand)" : "var(--pd-text)",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
  };
}

const btn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "var(--pd-brand)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
