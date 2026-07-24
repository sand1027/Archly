"use client";

import { useState, useCallback } from "react";
import {
  COMPONENTS,
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  searchComponents,
  getComponentsByCategory,
  COMPONENT_COUNT,
} from "@/lib/components-registry";
import type { ComponentCategory, ComponentDefinition } from "@/types";

export default function ComponentPalette() {
  const [search, setSearch]           = useState("");
  const [activeCategory, setActiveCategory] = useState<ComponentCategory | "all">("all");
  const [collapsed, setCollapsed]     = useState(false);

  const results = search.trim()
    ? searchComponents(search)
    : activeCategory === "all"
    ? COMPONENTS
    : getComponentsByCategory(activeCategory);

  const handleDragStart = useCallback((e: React.DragEvent, component: ComponentDefinition) => {
    e.dataTransfer.setData("application/archly-component", component.id);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Open components"
        style={{
          position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
          zIndex: 90, width: 28, height: 52,
          borderRadius: "var(--pd-radius)",
          background: "var(--pd-surface)",
          border: "1px solid var(--pd-border)",
          boxShadow: "var(--pd-shadow)",
          cursor: "pointer", color: "var(--pd-text-muted)", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >›</button>
    );
  }

  return (
    <aside style={{
      width: "var(--pd-sidebar-width)", height: "100%",
      background: "var(--pd-surface)",
      borderRight: "1px solid var(--pd-border)",
      display: "flex", flexDirection: "column",
      flexShrink: 0, overflow: "hidden",
      // isolation prevents Excalidraw CSS leaking into this panel
      isolation: "isolate",
      position: "relative",
      zIndex: 1,
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "10px 12px 8px",
        borderBottom: "1px solid var(--pd-border)",
        flexShrink: 0,
        background: "var(--pd-sidebar-bg)",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 8,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: "var(--pd-text-subtle)",
            textTransform: "uppercase", letterSpacing: "0.1em",
          }}>Components</span>
          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--pd-text-subtle)", padding: "2px 4px",
              borderRadius: "var(--pd-radius-sm)", fontSize: 14,
            }}
          >‹</button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}
            aria-hidden="true" overflow="hidden"
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              color: "var(--pd-text-subtle)", pointerEvents: "none", display: "block",
            }}>
            <path d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pd-input"
            style={{ paddingLeft: 28, fontSize: 12 }}
          />
        </div>
      </div>

      {/* ── Category filter row ── */}
      {!search && (
        <div className="scrollbar-hide" style={{
          display: "flex", gap: 4, padding: "6px 10px",
          overflowX: "auto", borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0, background: "var(--pd-sidebar-bg)",
        }}>
          <CatChip
            label="All"
            active={activeCategory === "all"}
            color="#6b7280"
            onClick={() => setActiveCategory("all")}
          />
          {CATEGORIES.map((cat) => (
            <CatChip
              key={cat}
              label={CATEGORY_LABELS[cat].split(" ")[0]}
              active={activeCategory === cat}
              color={CATEGORY_COLORS[cat]}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      )}

      {/* ── Component grid ── */}
      <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {/* Category label when not searching */}
        {!search && activeCategory !== "all" && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: CATEGORY_COLORS[activeCategory],
            marginBottom: 8, paddingLeft: 2,
          }}>
            {CATEGORY_LABELS[activeCategory]}
          </div>
        )}

        {/* Grouped by category when showing all */}
        {!search && activeCategory === "all" ? (
          <AllCategoriesGrid onDragStart={handleDragStart} />
        ) : results.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            color: "var(--pd-text-subtle)", fontSize: 12,
          }}>
            No components found
          </div>
        ) : (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
          }}>
            {results.map((comp) => (
              <ComponentCard
                key={comp.id}
                component={comp}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: "5px 12px", borderTop: "1px solid var(--pd-border)",
        fontSize: 10, color: "var(--pd-text-subtle)",
        display: "flex", justifyContent: "space-between",
        flexShrink: 0, background: "var(--pd-sidebar-bg)",
      }}>
        <span>{results.length} shown</span>
        <span>{COMPONENT_COUNT} total</span>
      </div>
    </aside>
  );
}

// ─── All categories grouped view ──────────────────────────────────────────

function AllCategoriesGrid({ onDragStart }: {
  onDragStart: (e: React.DragEvent, c: ComponentDefinition) => void;
}) {
  return (
    <>
      {CATEGORIES.map((cat) => {
        const comps = COMPONENTS.filter((c) => c.category === cat);
        if (!comps.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: CATEGORY_COLORS[cat],
              marginBottom: 6, paddingLeft: 2,
            }}>
              {CATEGORY_LABELS[cat]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {comps.map((comp) => (
                <ComponentCard key={comp.id} component={comp} onDragStart={onDragStart} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Component card — matches archly 2-column card style ─────────────────

function ComponentCard({ component, onDragStart }: {
  component: ComponentDefinition;
  onDragStart: (e: React.DragEvent, c: ComponentDefinition) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, component)}
      title={component.description}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6, padding: "10px 6px",
        borderRadius: "var(--pd-radius)",
        border: "1px solid var(--pd-border)",
        background: "var(--pd-surface)",
        cursor: "grab",
        transition: "border-color 120ms, box-shadow 120ms, transform 80ms",
        userSelect: "none",
        minHeight: 76,
        textAlign: "center",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = component.strokeColor;
        el.style.boxShadow = `0 0 0 1px ${component.strokeColor}22, var(--pd-shadow-sm)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--pd-border)";
        el.style.boxShadow = "none";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(0.96)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: 36, height: 36,
        borderRadius: "var(--pd-radius)",
        background: component.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke={component.strokeColor}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          overflow="hidden"
          style={{ display: "block", flexShrink: 0 }}
        >
          <path d={component.icon} />
        </svg>
      </div>

      {/* Name */}
      <span style={{
        fontSize: 11, fontWeight: 500, color: "var(--pd-text)",
        lineHeight: 1.3, textAlign: "center",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {component.name}
      </span>
    </div>
  );
}

// ─── Category chip ────────────────────────────────────────────────────────

function CatChip({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        borderRadius: "var(--pd-radius-full)",
        border: active ? `1.5px solid ${color}` : "1.5px solid var(--pd-border)",
        background: active ? `${color}18` : "transparent",
        color: active ? color : "var(--pd-text-muted)",
        fontSize: 11, fontWeight: active ? 700 : 500,
        cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}
