"use client";

import { useMemo, useState, useCallback } from "react";
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

const SHORT_LABELS: Record<ComponentCategory, string> = {
  clients: "Clients",
  traffic_edge: "Edge",
  compute: "Compute",
  storage: "Storage",
  messaging: "Queue",
  observability: "Obs",
  network: "Net",
  ai_agents: "AI",
  external: "Ext",
};

export default function ComponentPalette() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ComponentCategory | "all">("all");
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<ComponentCategory>>(new Set());

  const results = useMemo(
    () =>
      search.trim()
        ? searchComponents(search)
        : activeCategory === "all"
          ? COMPONENTS
          : getComponentsByCategory(activeCategory),
    [search, activeCategory]
  );

  const handleDragStart = useCallback((e: React.DragEvent, component: ComponentDefinition) => {
    e.dataTransfer.setData("application/archly-component", component.id);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const toggleCat = (cat: ComponentCategory) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Open components"
        aria-label="Open components"
        style={{
          position: "absolute",
          left: 8,
          top: 72,
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          width: 32,
          padding: "10px 0",
          borderRadius: 10,
          background: "var(--pd-surface)",
          border: "1px solid var(--pd-border)",
          boxShadow: "var(--pd-shadow)",
          cursor: "pointer",
          color: "var(--pd-text-muted)",
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>›</span>
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Components
        </span>
      </button>
    );
  }

  return (
    <aside
      className="component-palette"
      style={{
        width: "var(--pd-sidebar-width)",
        height: "100%",
        background: "var(--pd-sidebar-bg)",
        borderRight: "1px solid var(--pd-sidebar-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        isolation: "isolate",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px 10px",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
          background: "var(--pd-surface)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "var(--pd-text)",
                letterSpacing: "-0.01em",
              }}
            >
              Components
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--pd-text-subtle)",
                background: "var(--pd-bg-muted)",
                padding: "1px 6px",
                borderRadius: 999,
              }}
            >
              {COMPONENT_COUNT}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse"
            aria-label="Collapse components"
            style={{
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: 6,
              cursor: "pointer",
              color: "var(--pd-text-subtle)",
              fontSize: 14,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--pd-bg-muted)";
              e.currentTarget.style.borderColor = "var(--pd-border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            ‹
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <svg
            viewBox="0 0 24 24"
            width={13}
            height={13}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--pd-text-subtle)",
              pointerEvents: "none",
            }}
          >
            <path d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pd-input"
            style={{
              paddingLeft: 30,
              paddingRight: search ? 28 : 10,
              fontSize: 12,
              height: 32,
              borderRadius: 8,
              background: "var(--pd-bg-subtle)",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 18,
                height: 18,
                border: "none",
                borderRadius: 4,
                background: "transparent",
                color: "var(--pd-text-subtle)",
                cursor: "pointer",
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Category filters */}
      {!search && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "8px 10px",
            borderBottom: "1px solid var(--pd-border)",
            flexShrink: 0,
            background: "var(--pd-surface)",
          }}
        >
          <CatChip
            label="All"
            active={activeCategory === "all"}
            color="var(--pd-brand)"
            onClick={() => setActiveCategory("all")}
          />
          {CATEGORIES.map((cat) => (
            <CatChip
              key={cat}
              label={SHORT_LABELS[cat]}
              active={activeCategory === cat}
              color={CATEGORY_COLORS[cat]}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      )}

      {/* Component list */}
      <div
        className="scrollbar-hide"
        style={{ flex: 1, overflowY: "auto", padding: "8px 8px 12px" }}
      >
        {search.trim() || activeCategory !== "all" ? (
          results.length === 0 ? (
            <EmptyState query={search.trim()} />
          ) : (
            <>
              {!search && activeCategory !== "all" && (
                <SectionLabel
                  color={CATEGORY_COLORS[activeCategory]}
                  label={CATEGORY_LABELS[activeCategory]}
                  count={results.length}
                />
              )}
              {search.trim() && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--pd-text-subtle)",
                    margin: "0 4px 8px",
                  }}
                >
                  {results.length} match{results.length === 1 ? "" : "es"}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {results.map((comp) => (
                  <ComponentCard
                    key={comp.id}
                    component={comp}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            </>
          )
        ) : (
          CATEGORIES.map((cat) => {
            const comps = COMPONENTS.filter((c) => c.category === cat);
            if (!comps.length) return null;
            const isClosed = collapsedCats.has(cat);
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => toggleCat(cat)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 4px 6px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: CATEGORY_COLORS[cat],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--pd-text-muted)",
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--pd-text-subtle)",
                    }}
                  >
                    {comps.length}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--pd-text-subtle)",
                      transform: isClosed ? "rotate(-90deg)" : "none",
                      transition: "transform 120ms ease",
                    }}
                  >
                    ▾
                  </span>
                </button>
                {!isClosed && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {comps.map((comp) => (
                      <ComponentCard
                        key={comp.id}
                        component={comp}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer tip */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--pd-border)",
          fontSize: 10,
          color: "var(--pd-text-subtle)",
          flexShrink: 0,
          background: "var(--pd-surface)",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>Drag onto canvas</span>
        <span style={{ fontWeight: 600 }}>
          {results.length}/{COMPONENT_COUNT}
        </span>
      </div>
    </aside>
  );
}

function SectionLabel({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        margin: "0 2px 8px",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--pd-text-muted)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 10, color: "var(--pd-text-subtle)", marginLeft: "auto" }}>
        {count}
      </span>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div
      style={{
        padding: "28px 12px",
        textAlign: "center",
        color: "var(--pd-text-subtle)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pd-text-muted)", marginBottom: 4 }}>
        No matches
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.4 }}>
        {query ? `Nothing for “${query}”` : "No components in this category"}
      </div>
    </div>
  );
}

function ComponentCard({
  component,
  onDragStart,
}: {
  component: ComponentDefinition;
  onDragStart: (e: React.DragEvent, c: ComponentDefinition) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, component)}
      title={component.description}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "8px 4px",
        borderRadius: 8,
        border: "1px solid var(--pd-border)",
        background: "var(--pd-surface)",
        cursor: "grab",
        transition: "border-color 120ms, box-shadow 120ms, background 120ms, transform 80ms",
        userSelect: "none",
        minHeight: 68,
        textAlign: "center",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = component.strokeColor;
        el.style.background = "var(--pd-surface-raised)";
        el.style.boxShadow = `0 0 0 1px ${component.strokeColor}22, var(--pd-shadow-sm)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--pd-border)";
        el.style.background = "var(--pd-surface)";
        el.style.boxShadow = "none";
        el.style.transform = "scale(1)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: component.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={15}
          height={15}
          fill="none"
          stroke={component.strokeColor}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ display: "block", flexShrink: 0 }}
        >
          <path d={component.icon} />
        </svg>
      </div>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          color: "var(--pd-text)",
          lineHeight: 1.25,
          textAlign: "center",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          padding: "0 2px",
        }}
      >
        {component.name}
      </span>
    </div>
  );
}

function CatChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 8px",
        borderRadius: 6,
        border: active ? `1px solid ${color}` : "1px solid var(--pd-border)",
        background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent",
        color: active ? color : "var(--pd-text-muted)",
        fontSize: 10.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        flexShrink: 0,
        whiteSpace: "nowrap",
        transition: "all 120ms",
        lineHeight: 1.3,
      }}
    >
      {label}
    </button>
  );
}
