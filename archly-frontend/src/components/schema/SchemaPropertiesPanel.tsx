"use client";

import { useSchemaStore } from "@/store/schema.store";
import type { CSSProperties } from "react";
import type { SchemaColumn, SchemaTableData } from "@/types/schema";

export default function SchemaPropertiesPanel() {
  const selectedTableId = useSchemaStore((s) => s.selectedTableId);
  const nodes = useSchemaStore((s) => s.nodes);
  const updateTable = useSchemaStore((s) => s.updateTable);
  const removeTable = useSchemaStore((s) => s.removeTable);

  const node = nodes.find((n) => n.id === selectedTableId);
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
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--pd-bg-muted)",
            border: "1px solid var(--pd-border)",
            display: "grid",
            placeItems: "center",
            color: "var(--pd-text-subtle)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          DB
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--pd-text-muted)" }}>
          No table selected
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--pd-text-subtle)",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Click a table to edit name and columns
        </p>
      </div>
    );
  }

  const data = node.data as SchemaTableData;
  const columns = data.columns ?? [];

  const setName = (tableName: string) => updateTable(node.id, { tableName });
  const setColumns = (next: SchemaColumn[]) => updateTable(node.id, { columns: next });

  const updateCol = (idx: number, patch: Partial<SchemaColumn>) => {
    setColumns(columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const addCol = () => {
    setColumns([...columns, { name: "new_column", type: "text", nullable: true }]);
  };

  const removeCol = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

      <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: 12 }}>
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
