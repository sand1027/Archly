"use client";

import {
  SCHEMA_CATEGORY_LABELS,
  SCHEMA_PACKS,
  SCHEMA_TABLE_TEMPLATES,
  type SchemaTableTemplate,
} from "@/lib/schema/schema-templates";
import SchemaDbImport from "@/components/schema/SchemaDbImport";
import { useSchemaStore } from "@/store/schema.store";
import type { CSSProperties } from "react";

interface Props {
  onOpenAi?: (prompt?: string) => void;
}

const CATEGORY_ORDER: SchemaTableTemplate["category"][] = [
  "core",
  "auth",
  "commerce",
  "content",
  "ops",
];

export default function SchemaPalette({ onOpenAi }: Props) {
  const addTable = useSchemaStore((s) => s.addTable);
  const applyPack = useSchemaStore((s) => s.applyPack);

  const onDragStart = (e: React.DragEvent, tpl: SchemaTableTemplate) => {
    e.dataTransfer.setData(
      "application/archly-schema-table",
      JSON.stringify({
        tableName: tpl.name,
        columns: tpl.columns,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const dropAtDefault = (tpl: SchemaTableTemplate) => {
    const n = useSchemaStore.getState().nodes.length;
    addTable(tpl.name, structuredClone(tpl.columns), {
      x: 120 + (n % 4) * 40,
      y: 100 + (n % 4) * 40,
    });
  };

  const dropPack = (packId: string) => {
    const pack = SCHEMA_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    applyPack(
      pack.tables.map((t) => ({
        tableName: t.name,
        columns: structuredClone(t.columns),
      })),
      pack.relations.map((r) => ({ ...r })),
      { x: 60, y: 60 }
    );
  };

  return (
    <aside
      style={{
        width: "var(--pd-sidebar-width)",
        height: "100%",
        background: "var(--pd-sidebar-bg)",
        borderRight: "1px solid var(--pd-sidebar-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 12px 10px",
          borderBottom: "1px solid var(--pd-border)",
          background: "var(--pd-surface)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pd-text)" }}>
          Schema
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--pd-text-subtle)", lineHeight: 1.4 }}>
          AI generate, starter packs, or drag tables
        </p>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "10px 10px 14px" }}>
        <SchemaDbImport variant="panel" />

        {/* AI — primary path */}
        <button
          type="button"
          onClick={() => onOpenAi?.()}
          style={{
            width: "100%",
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid color-mix(in srgb, var(--pd-brand) 35%, var(--pd-border))",
            background: "color-mix(in srgb, var(--pd-brand) 12%, var(--pd-surface))",
            color: "var(--pd-text)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span>Generate with AI</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--pd-text-subtle)" }}>
            Describe a product → full ERD with FKs
          </span>
        </button>

        <SectionTitle>Starter packs</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {SCHEMA_PACKS.map((pack) => (
            <div
              key={pack.id}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--pd-border)",
                background: "var(--pd-surface)",
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pd-text)" }}>
                {pack.name}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--pd-text-subtle)", marginTop: 2, marginBottom: 8 }}>
                {pack.hint}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => dropPack(pack.id)} style={btnSecondary}>
                  Drop pack
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAi?.(pack.aiPrompt)}
                  style={btnAi}
                >
                  AI expand
                </button>
              </div>
            </div>
          ))}
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const items = SCHEMA_TABLE_TEMPLATES.filter((t) => t.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <SectionTitle>{SCHEMA_CATEGORY_LABELS[cat]}</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((tpl) => (
                  <div
                    key={tpl.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, tpl)}
                    onDoubleClick={() => dropAtDefault(tpl)}
                    title="Drag onto canvas, or double-click to add"
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--pd-border)",
                      background: "var(--pd-surface)",
                      cursor: "grab",
                      userSelect: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pd-text)" }}>
                        {tpl.label}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dropAtDefault(tpl);
                        }}
                        style={{
                          ...btnSecondary,
                          padding: "3px 8px",
                          fontSize: 10,
                        }}
                      >
                        Add
                      </button>
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--pd-text-subtle)", marginTop: 2 }}>
                      {tpl.hint} · {tpl.columns.length} cols
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 9.5,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        color: "var(--pd-text-subtle)",
                        lineHeight: 1.35,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tpl.columns
                        .slice(0, 4)
                        .map((c) => c.name)
                        .join(", ")}
                      {tpl.columns.length > 4 ? "…" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--pd-border)",
          fontSize: 10,
          color: "var(--pd-text-subtle)",
          background: "var(--pd-surface)",
        }}
      >
        Connect handles for relationships · Export → SQL / Mermaid
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--pd-text-subtle)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

const btnSecondary: CSSProperties = {
  flex: 1,
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
  color: "var(--pd-text)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const btnAi: CSSProperties = {
  flex: 1,
  padding: "5px 8px",
  borderRadius: 6,
  border: "none",
  background: "var(--pd-brand)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
