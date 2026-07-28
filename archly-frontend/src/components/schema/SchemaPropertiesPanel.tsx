"use client";

import { useEffect } from "react";
import { useSchemaStore } from "@/store/schema.store";
import { tableConnections } from "@/lib/schema/schema-diff";
import { useSchemaExplain } from "@/hooks/useSchemaExplain";
import { readStoredAiProvider } from "@/lib/ai/providers";
import { architectureForThisSchemaPrompt } from "@/lib/schema/cross-prompts";
import type { CSSProperties } from "react";
import type { SchemaColumn, SchemaTableData } from "@/types/schema";

export default function SchemaPropertiesPanel({
  onOpenArchitecture,
}: {
  onOpenArchitecture?: (prompt: string) => void;
} = {}) {
  const selectedTableId = useSchemaStore((s) => s.selectedTableId);
  const nodes = useSchemaStore((s) => s.nodes);
  const edges = useSchemaStore((s) => s.edges);
  const updateTable = useSchemaStore((s) => s.updateTable);
  const removeTable = useSchemaStore((s) => s.removeTable);

  const { text, isStreaming, explainTable, cancel, clear } = useSchemaExplain();

  const node = nodes.find((n) => n.id === selectedTableId);

  useEffect(() => {
    clear();
    cancel();
  }, [selectedTableId, clear, cancel]);

  if (!node) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 24,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--pd-text-muted)" }}>
          No table selected
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--pd-text-subtle)", textAlign: "center" }}>
          Click a table to edit, see connections, or ask AI what it is used for
        </p>
      </div>
    );
  }

  const data = node.data as SchemaTableData;
  const columns = data.columns ?? [];
  const { inbound, outbound } = tableConnections(data.tableName, nodes, edges);

  const setName = (tableName: string) => updateTable(node.id, { tableName });
  const setColumns = (next: SchemaColumn[]) => updateTable(node.id, { columns: next });

  const updateCol = (idx: number, patch: Partial<SchemaColumn>) => {
    setColumns(columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const addCol = () =>
    setColumns([...columns, { name: "new_column", type: "text", nullable: true }]);
  const removeCol = (idx: number) => setColumns(columns.filter((_, i) => i !== idx));

  const runExplain = () => {
    explainTable(data.tableName, nodes, edges, node.id, readStoredAiProvider("groq"));
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--pd-border)",
          background: "var(--pd-surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--pd-text-subtle)", marginBottom: 4 }}>
          TABLE
        </div>
        <input
          className="pd-input"
          value={data.tableName}
          onChange={(e) => setName(e.target.value)}
          style={{ fontWeight: 700, fontSize: 13 }}
        />
      </div>

      {/* Single scroll region: connections + AI + columns */}
      <div
        className="scrollbar-hide"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {(inbound.length > 0 || outbound.length > 0) && (
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--pd-border)",
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            {inbound.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: "var(--pd-text-subtle)" }}>Referenced by: </span>
                {inbound.join(", ")}
              </div>
            )}
            {outbound.length > 0 && (
              <div>
                <span style={{ fontWeight: 700, color: "var(--pd-text-subtle)" }}>References: </span>
                {outbound.join(", ")}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--pd-border)" }}>
          {onOpenArchitecture && (
            <button
              type="button"
              onClick={() => {
                const prompt = architectureForThisSchemaPrompt(nodes, edges);
                if (prompt) onOpenArchitecture(prompt);
              }}
              style={{
                width: "100%",
                marginBottom: 8,
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid color-mix(in srgb, var(--pd-brand) 35%, var(--pd-border))",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--pd-brand) 14%, var(--pd-surface)), var(--pd-surface))",
                color: "var(--pd-text)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  background: "color-mix(in srgb, var(--pd-brand) 16%, transparent)",
                  color: "var(--pd-brand)",
                  fontSize: 14,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                ⌁
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span>Open Architecture</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--pd-text-subtle)" }}>
                  Generate system design from this ERD
                </span>
              </span>
              <span style={{ marginLeft: "auto", color: "var(--pd-brand)", fontWeight: 800 }}>→</span>
            </button>
          )}
          <button
            type="button"
            onClick={runExplain}
            disabled={isStreaming}
            style={explainBtnStyle}
          >
            {isStreaming ? "Explaining…" : "Explain this table (AI)"}
          </button>
          {isStreaming && (
            <button
              type="button"
              onClick={cancel}
              style={{
                ...explainBtnStyle,
                marginTop: 6,
                background: "transparent",
                color: "var(--pd-text-muted)",
              }}
            >
              Stop
            </button>
          )}
          {text && (
            <div
              style={{
                marginTop: 8,
                maxHeight: 180,
                overflowY: "auto",
                padding: 8,
                borderRadius: 8,
                border: "1px solid var(--pd-border)",
                background: "var(--pd-bg-subtle)",
                fontSize: 11.5,
                color: "var(--pd-text)",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {text}
            </div>
          )}
        </div>

        <div style={{ padding: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pd-text-subtle)" }}>
              COLUMNS
            </span>
            <button
              type="button"
              onClick={addCol}
              style={{
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                background: "transparent",
                color: "var(--pd-brand)",
                cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {columns.map((c, idx) => (
              <div
                key={`${c.name}-${idx}`}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid var(--pd-border)",
                  background: "var(--pd-bg-subtle)",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--pd-text-subtle)" }}>Name</span>
                    <input
                      className="pd-input"
                      value={c.name}
                      onChange={(e) => updateCol(idx, { name: e.target.value })}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--pd-text-subtle)" }}>Type</span>
                    <input
                      className="pd-input"
                      value={c.type}
                      onChange={(e) => updateCol(idx, { type: e.target.value })}
                    />
                  </label>
                </div>
                {c.fk && (
                  <div style={{ marginTop: 6, fontSize: 10, color: "var(--pd-brand)" }}>
                    FK → {c.fk.table}.{c.fk.column}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                  <label style={chk}>
                    <input
                      type="checkbox"
                      checked={!!c.pk}
                      onChange={(e) => updateCol(idx, { pk: e.target.checked })}
                    />
                    PK
                  </label>
                  <label style={chk}>
                    <input
                      type="checkbox"
                      checked={!!c.unique}
                      onChange={(e) => updateCol(idx, { unique: e.target.checked })}
                    />
                    UK
                  </label>
                  <label style={chk}>
                    <input
                      type="checkbox"
                      checked={c.nullable !== false && !c.pk}
                      onChange={(e) => updateCol(idx, { nullable: e.target.checked })}
                    />
                    Null
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCol(idx)}
                    style={{
                      marginLeft: "auto",
                      border: "none",
                      background: "none",
                      color: "var(--pd-text-subtle)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--pd-border)", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => removeTable(node.id)}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 8,
            border: "1px solid color-mix(in srgb, #dc2626 35%, transparent)",
            background: "color-mix(in srgb, #dc2626 8%, transparent)",
            color: "#dc2626",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Delete table
        </button>
      </div>
    </div>
  );
}

const chk: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  color: "var(--pd-text-muted)",
  fontWeight: 600,
};

const explainBtnStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid color-mix(in srgb, var(--pd-brand) 35%, var(--pd-border))",
  background: "color-mix(in srgb, var(--pd-brand) 10%, var(--pd-surface))",
  color: "var(--pd-text)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
