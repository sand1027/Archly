"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  COMPONENTS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  searchComponents,
  getComponent,
  type ComponentCategory,
  type ComponentDefinition,
} from "@/lib/components-registry";
import {
  CATEGORY_INTROS,
  CONFIG_GLOSSARY,
  GUIDE_LABS,
  type GlossaryEntry,
  type LabDefinition,
} from "@/lib/guide/content";
import { getNodeLesson } from "@/lib/guide/node-lessons";
import {
  applyGuideLab,
  placeOrFocusComponent,
  type GuideCanvasTarget,
} from "@/lib/guide/apply-lab";

type TabId = "labs" | "components" | "glossary";

interface GuidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: GuideCanvasTarget;
  onPreferFlow?: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "labs", label: "Labs" },
  { id: "components", label: "Nodes" },
  { id: "glossary", label: "Config" },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ComponentCategory[];

const LEVEL_COLOR = {
  beginner: "#16a34a",
  intermediate: "#d97706",
  advanced: "#dc2626",
} as const;

export default function GuidePanel({
  isOpen,
  onClose,
  canvas,
  onPreferFlow,
}: GuidePanelProps) {
  const [tab, setTab] = useState<TabId>("labs");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComponentCategory | "all">("all");
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [labStep, setLabStep] = useState(0);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const components = useMemo(() => {
    let list = query.trim() ? searchComponents(query) : COMPONENTS;
    if (category !== "all") list = list.filter((c) => c.category === category);
    return list;
  }, [query, category]);

  const glossary = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONFIG_GLOSSARY;
    return CONFIG_GLOSSARY.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.detail.toLowerCase().includes(q) ||
        g.section.toLowerCase().includes(q)
    );
  }, [query]);

  const activeLab = GUIDE_LABS.find((l) => l.id === activeLabId) ?? null;
  const selectedComp = selectedCompId ? getComponent(selectedCompId) ?? null : null;

  if (!isOpen) return null;

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const startLab = (lab: LabDefinition) => {
    onPreferFlow?.();
    const target: GuideCanvasTarget = onPreferFlow ? "flow" : canvas;
    applyGuideLab(lab, target);
    setActiveLabId(lab.id);
    setLabStep(0);
    flash(`Loaded “${lab.title}” + Architecture Notes`);
  };

  const onComponentClick = (comp: ComponentDefinition) => {
    setSelectedCompId(comp.id);
    placeOrFocusComponent(comp.id, canvas);
    flash(`Selected / placed ${comp.name}`);
  };

  return (
    <aside role="dialog" aria-label="Student guide" style={shell}>
      <div style={header}>
        <span style={{ fontSize: 16 }}>📚</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pd-text)" }}>
            Student Guide
          </div>
          <div style={{ fontSize: 11, color: "var(--pd-text-muted)" }}>
            Why · when · architecture · labs
          </div>
        </div>
        <button type="button" onClick={onClose} style={iconBtn} title="Close">
          ✕
        </button>
      </div>

      <div style={tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...tabBtn,
              color: tab === t.id ? "var(--pd-brand)" : "var(--pd-text-muted)",
              borderBottom:
                tab === t.id
                  ? "2px solid var(--pd-brand)"
                  : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "components" || tab === "glossary") && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--pd-border)" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "components" ? "Search nodes (e.g. cache, kafka)…" : "Search config terms…"
            }
            style={searchInput}
          />
        </div>
      )}

      {status && (
        <div
          style={{
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "#16a34a",
            background: "color-mix(in srgb, #16a34a 10%, transparent)",
            borderBottom: "1px solid var(--pd-border)",
          }}
        >
          {status}
        </div>
      )}

      <div style={body}>
        {tab === "labs" && (
          <LabsView
            activeLab={activeLab}
            labStep={labStep}
            onStart={startLab}
            onStep={setLabStep}
            onBack={() => {
              setActiveLabId(null);
              setLabStep(0);
            }}
            onOpenNode={(id) => {
              setTab("components");
              setSelectedCompId(id);
              setCategory("all");
              setQuery("");
              const c = getComponent(id);
              if (c) placeOrFocusComponent(c.id, canvas);
            }}
          />
        )}

        {tab === "components" && (
          <ComponentsView
            category={category}
            onCategory={setCategory}
            components={components}
            selected={selectedComp}
            onPick={onComponentClick}
            onClearSelected={() => setSelectedCompId(null)}
          />
        )}

        {tab === "glossary" && <GlossaryView entries={glossary} />}
      </div>
    </aside>
  );
}

function LabsView({
  activeLab,
  labStep,
  onStart,
  onStep,
  onBack,
  onOpenNode,
}: {
  activeLab: LabDefinition | null;
  labStep: number;
  onStart: (lab: LabDefinition) => void;
  onStep: (n: number) => void;
  onBack: () => void;
  onOpenNode: (componentId: string) => void;
}) {
  if (activeLab) {
    const step = activeLab.steps[labStep];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="button" onClick={onBack} style={linkBtn}>
          ← All labs
        </button>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--pd-text)" }}>
              {activeLab.title}
            </span>
            <LevelBadge level={activeLab.level} />
            <span style={{ fontSize: 10, color: "var(--pd-text-subtle)" }}>{activeLab.duration}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--pd-text-muted)", marginTop: 2 }}>
            {activeLab.subtitle}
          </div>
        </div>

        <Callout title="Why this architecture?" body={activeLab.architectureWhy} />

        <div>
          <SectionLabel>Learning goals</SectionLabel>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.45, color: "var(--pd-text)" }}>
            {activeLab.learningGoals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>

        <div>
          <SectionLabel>Nodes in this design</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {activeLab.nodeRoles.map((r) => {
              const comp = getComponent(r.componentId);
              return (
                <button
                  key={r.componentId}
                  type="button"
                  onClick={() => onOpenNode(r.componentId)}
                  style={roleCard}
                >
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {comp?.name ?? r.componentId}
                    <span style={{ fontWeight: 500, color: "var(--pd-brand)" }}> · {r.role}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--pd-text-muted)", marginTop: 2 }}>
                    {r.whyHere}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {activeLab.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onStep(i)}
              style={{
                flex: 1,
                height: 4,
                border: "none",
                borderRadius: 2,
                cursor: "pointer",
                background:
                  i === labStep
                    ? "var(--pd-brand)"
                    : i < labStep
                      ? "color-mix(in srgb, var(--pd-brand) 45%, transparent)"
                      : "var(--pd-bg-muted)",
              }}
            />
          ))}
        </div>

        {step && (
          <div style={stepCard}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
              Step {labStep + 1}: {step.title}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--pd-text)", margin: 0 }}>
              {step.body}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={labStep === 0} onClick={() => onStep(labStep - 1)} style={secondaryBtn}>
            Prev
          </button>
          <button
            type="button"
            disabled={labStep >= activeLab.steps.length - 1}
            onClick={() => onStep(labStep + 1)}
            style={primaryBtn}
          >
            Next
          </button>
        </div>

        <div style={tryCard}>
          <strong>Try it:</strong> {activeLab.tryIt}
        </div>

        <p style={{ fontSize: 11, color: "var(--pd-text-muted)", margin: 0, lineHeight: 1.4 }}>
          Tip: the yellow <strong>Architecture Notes</strong> node on the canvas summarizes this design — drag it anywhere.
        </p>

        <button type="button" onClick={() => onStart(activeLab)} style={secondaryBtn}>
          Reload diagram + notes
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 12, color: "var(--pd-text-muted)", lineHeight: 1.45, margin: 0 }}>
        Each lab drops a diagram <em>and</em> an Architecture Notes node explaining why the design exists and what every hop does.
      </p>
      {GUIDE_LABS.map((lab) => (
        <button key={lab.id} type="button" onClick={() => onStart(lab)} style={labCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{lab.title}</span>
            <LevelBadge level={lab.level} />
          </div>
          <div style={{ fontSize: 11, color: "var(--pd-text-muted)", marginTop: 4 }}>{lab.subtitle}</div>
          <div style={{ fontSize: 11, color: "var(--pd-text)", marginTop: 8, lineHeight: 1.4 }}>
            {lab.architectureWhy.slice(0, 120)}…
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
            <span style={{ color: "var(--pd-text-subtle)" }}>{lab.duration} · {lab.nodes.length} nodes</span>
            <span style={{ fontWeight: 700, color: "var(--pd-brand)" }}>Start →</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function ComponentsView({
  category,
  onCategory,
  components,
  selected,
  onPick,
  onClearSelected,
}: {
  category: ComponentCategory | "all";
  onCategory: (c: ComponentCategory | "all") => void;
  components: ComponentDefinition[];
  selected: ComponentDefinition | null;
  onPick: (c: ComponentDefinition) => void;
  onClearSelected: () => void;
}) {
  if (selected) {
    const lesson = getNodeLesson(selected.id, selected);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="button" onClick={onClearSelected} style={linkBtn}>
          ← All nodes
        </button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: selected.color,
              border: `1.5px solid ${selected.strokeColor}`,
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: "var(--pd-text-muted)" }}>
              {CATEGORY_ICONS[selected.category]} {CATEGORY_LABELS[selected.category]}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 12, lineHeight: 1.45, margin: 0, color: "var(--pd-text)" }}>
          {selected.description}
        </p>

        <LessonBlock title="Why is it used?" body={lesson.why} />
        <LessonBlock title="When to use" body={lesson.when} tone="good" />
        <LessonBlock title="When to avoid" body={lesson.avoid} tone="warn" />
        <LessonBlock title="Interview tip" body={lesson.interviewTip} tone="brand" />

        {lesson.pairsWith.length > 0 && (
          <div>
            <SectionLabel>Often pairs with</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {lesson.pairsWith.map((id) => {
                const c = getComponent(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => c && onPick(c)}
                    style={chipSm}
                  >
                    {c?.name ?? id}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button type="button" onClick={() => onPick(selected)} style={primaryBtn}>
          Place / select on canvas
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <Chip active={category === "all"} label="All" onClick={() => onCategory("all")} />
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            active={category === cat}
            label={`${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`}
            onClick={() => onCategory(cat)}
          />
        ))}
      </div>

      {category !== "all" && (
        <div
          style={{
            padding: 10,
            borderRadius: "var(--pd-radius)",
            background: `color-mix(in srgb, ${CATEGORY_COLORS[category]} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${CATEGORY_COLORS[category]} 25%, transparent)`,
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--pd-text)",
          }}
        >
          <strong>{CATEGORY_INTROS[category].title}</strong>
          <div style={{ marginTop: 4, color: "var(--pd-text-muted)" }}>
            {CATEGORY_INTROS[category].blurb}
          </div>
          <div style={{ marginTop: 6 }}>
            <strong>Why this category:</strong> {CATEGORY_INTROS[category].why}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--pd-text-subtle)" }}>
        {components.length} nodes · open a card for why / when / avoid
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {components.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c)} style={compCard}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: c.color,
                border: `1px solid ${c.strokeColor}`,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--pd-text)" }}>{c.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pd-text-muted)",
                  lineHeight: 1.35,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {getNodeLesson(c.id, c).why}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GlossaryView({ entries }: { entries: GlossaryEntry[] }) {
  const sections = ["Infrastructure", "Capacity", "Patterns", "Simulation", "Chaos"] as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12, color: "var(--pd-text-muted)", lineHeight: 1.45, margin: 0 }}>
        Every Properties panel knob, explained. Select a node on the canvas to edit these live.
      </p>
      {sections.map((section) => {
        const items = entries.filter((e) => e.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section}>
            <SectionLabel>{section}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {items.map((e) => (
                <details key={e.id} style={detailsCard}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    {e.label}
                    <span
                      style={{
                        display: "block",
                        fontWeight: 500,
                        color: "var(--pd-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {e.summary}
                    </span>
                  </summary>
                  <p style={{ fontSize: 12, lineHeight: 1.5, margin: "8px 0 0", color: "var(--pd-text)" }}>
                    {e.detail}
                  </p>
                  {e.tip && (
                    <p
                      style={{
                        fontSize: 11,
                        margin: "8px 0 0",
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "color-mix(in srgb, var(--pd-brand) 8%, transparent)",
                        color: "var(--pd-text)",
                      }}
                    >
                      <strong>Tip:</strong> {e.tip}
                    </p>
                  )}
                </details>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LevelBadge({ level }: { level: LabDefinition["level"] }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 999,
        color: LEVEL_COLOR[level],
        background: `color-mix(in srgb, ${LEVEL_COLOR[level]} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${LEVEL_COLOR[level]} 30%, transparent)`,
      }}
    >
      {level}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--pd-text-subtle)",
      }}
    >
      {children}
    </div>
  );
}

function Callout({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: "var(--pd-radius)",
        background: "color-mix(in srgb, var(--pd-brand) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--pd-brand) 25%, transparent)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, color: "var(--pd-brand)" }}>
        {title}
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--pd-text)" }}>{body}</p>
    </div>
  );
}

function LessonBlock({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "good" | "warn" | "brand";
}) {
  const color =
    tone === "good" ? "#16a34a" : tone === "warn" ? "#d97706" : tone === "brand" ? "var(--pd-brand)" : "var(--pd-text-subtle)";
  return (
    <div
      style={{
        padding: 10,
        borderRadius: "var(--pd-radius)",
        border: "1px solid var(--pd-border)",
        background: "var(--pd-bg)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 11, color, marginBottom: 4 }}>{title}</div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--pd-text)" }}>{body}</p>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: "var(--pd-radius-full)",
        border: active ? "1px solid var(--pd-brand)" : "1px solid var(--pd-border)",
        background: active
          ? "color-mix(in srgb, var(--pd-brand) 12%, transparent)"
          : "var(--pd-bg-muted)",
        color: active ? "var(--pd-brand)" : "var(--pd-text-muted)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const shell: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(420px, 100%)",
  zIndex: 200,
  display: "flex",
  flexDirection: "column",
  background: "var(--pd-surface-raised)",
  borderLeft: "1px solid var(--pd-border)",
  boxShadow: "var(--pd-shadow)",
  animation: "fade-in 160ms ease",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 14px",
  borderBottom: "1px solid var(--pd-border)",
  flexShrink: 0,
};

const tabRow: CSSProperties = {
  display: "flex",
  gap: 2,
  padding: "0 10px",
  borderBottom: "1px solid var(--pd-border)",
  flexShrink: 0,
};

const tabBtn: CSSProperties = {
  flex: 1,
  padding: "8px 4px",
  border: "none",
  background: "transparent",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const body: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 12,
};

const searchInput: CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "7px 10px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
  color: "var(--pd-text)",
  outline: "none",
  boxSizing: "border-box",
};

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

const labCard: CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg-muted)",
  cursor: "pointer",
  color: "var(--pd-text)",
};

const roleCard: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
  cursor: "pointer",
  color: "var(--pd-text)",
};

const compCard: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "8px 10px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
  cursor: "pointer",
};

const detailsCard: CSSProperties = {
  padding: "8px 10px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
  color: "var(--pd-text)",
};

const stepCard: CSSProperties = {
  padding: 12,
  borderRadius: "var(--pd-radius)",
  background: "var(--pd-bg-muted)",
  border: "1px solid var(--pd-border)",
};

const tryCard: CSSProperties = {
  padding: 10,
  borderRadius: "var(--pd-radius)",
  border: "1px dashed color-mix(in srgb, var(--pd-brand) 40%, transparent)",
  background: "color-mix(in srgb, var(--pd-brand) 6%, transparent)",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--pd-text)",
};

const primaryBtn: CSSProperties = {
  flex: 1,
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: "var(--pd-radius)",
  border: "none",
  background: "var(--pd-brand)",
  color: "#fff",
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  flex: 1,
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 12px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text)",
  cursor: "pointer",
};

const linkBtn: CSSProperties = {
  alignSelf: "flex-start",
  fontSize: 11,
  fontWeight: 600,
  border: "none",
  background: "transparent",
  color: "var(--pd-brand)",
  cursor: "pointer",
  padding: 0,
};

const chipSm: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg-muted)",
  color: "var(--pd-text)",
  cursor: "pointer",
};
