"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { SchemaColumn, SchemaTableData } from "@/types/schema";

function badge(col: SchemaColumn): string {
  if (col.pk) return "PK";
  if (col.fk) return "FK";
  if (col.unique) return "UK";
  return "";
}

export default function SchemaTableNode({ data, selected }: NodeProps) {
  const table = data as unknown as SchemaTableData;
  const columns = table.columns ?? [];

  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 260,
        borderRadius: 10,
        border: selected
          ? "1.5px solid var(--pd-brand)"
          : "1px solid var(--pd-border)",
        background: "var(--pd-surface)",
        boxShadow: selected ? "var(--pd-shadow)" : "var(--pd-shadow-sm)",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} id="t" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="b" style={handleStyle} />

      <div
        style={{
          padding: "8px 10px",
          background: "color-mix(in srgb, var(--pd-brand) 10%, var(--pd-surface))",
          borderBottom: "1px solid var(--pd-border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: "var(--pd-brand)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: "var(--pd-text)",
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {table.tableName}
        </span>
      </div>

      <div style={{ padding: "4px 0" }}>
        {columns.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--pd-text-subtle)" }}>
            No columns
          </div>
        ) : (
          columns.map((c) => {
            const b = badge(c);
            return (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  fontSize: 11,
                  lineHeight: 1.35,
                }}
              >
                <span
                  style={{
                    width: 22,
                    fontSize: 9,
                    fontWeight: 800,
                    color: c.pk
                      ? "var(--pd-brand)"
                      : c.fk
                        ? "var(--pd-sim-warn, #d97706)"
                        : "transparent",
                    flexShrink: 0,
                  }}
                >
                  {b || "·"}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: c.pk ? 700 : 500,
                    color: "var(--pd-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    color: "var(--pd-text-subtle)",
                    fontSize: 10,
                    flexShrink: 0,
                  }}
                >
                  {c.type}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const handleStyle: CSSProperties = {
  width: 7,
  height: 7,
  background: "var(--pd-brand)",
  border: "1.5px solid var(--pd-surface)",
};
