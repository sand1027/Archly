"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { INTERVIEW_PROBLEMS } from "@/lib/simulation/scenarios";
import type { InterviewDuration } from "@/types";

const DURATIONS: InterviewDuration[] = [20, 30, 45, 60];
const DIFFICULTIES = ["all", "easy", "medium", "hard"] as const;

export default function InterviewPage() {
  const router = useRouter();
  const [selectedDuration, setSelectedDuration] = useState<InterviewDuration | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<typeof DIFFICULTIES[number]>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = INTERVIEW_PROBLEMS.filter((p) => {
    const durationOk =
      selectedDuration === "all" || p.durationMins === selectedDuration;
    const diffOk =
      selectedDifficulty === "all" || p.difficulty === selectedDifficulty;
    return durationOk && diffOk;
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--pd-bg)",
        color: "var(--pd-text)",
        fontFamily: "Assistant, sans-serif",
      }}
    >
      {/* Nav */}
      <div
        style={{
          borderBottom: "1px solid var(--pd-border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 52,
        }}
      >
        <Link href="/canvas" style={{ color: "var(--pd-text-muted)", fontSize: 13, textDecoration: "none" }}>
          ← Canvas
        </Link>
        <span style={{ color: "var(--pd-border)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🎓 Interview Mode</span>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
          System Design Interview Practice
        </h1>
        <p style={{ color: "var(--pd-text-muted)", fontSize: 14, marginBottom: 28 }}>
          Pick a problem, set your timer, and design it on the canvas.
        </p>

        {/* Filters */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {/* Duration chips */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--pd-text-subtle)", marginRight: 2 }}>
              Duration:
            </span>
            <FilterChip
              label="Any"
              active={selectedDuration === "all"}
              onClick={() => setSelectedDuration("all")}
            />
            {DURATIONS.map((d) => (
              <FilterChip
                key={d}
                label={`${d}m`}
                active={selectedDuration === d}
                onClick={() => setSelectedDuration(d)}
                cssClass="imd-duration-chip--active"
              />
            ))}
          </div>

          {/* Difficulty chips */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--pd-text-subtle)", marginRight: 2 }}>
              Difficulty:
            </span>
            {DIFFICULTIES.map((d) => (
              <FilterChip
                key={d}
                label={d === "all" ? "Any" : d}
                active={selectedDifficulty === d}
                onClick={() => setSelectedDifficulty(d)}
                cssClass="imd-filter-chip--active"
              />
            ))}
          </div>
        </div>

        {/* Problem list */}
        <div className="imd-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((problem) => (
            <div
              key={problem.id}
              className={`imd-problem-row${hoveredId === problem.id ? " imd-problem-row--active" : ""}`}
              onMouseEnter={() => setHoveredId(problem.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => router.push(`/interview/${problem.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                borderRadius: "var(--pd-radius-lg)",
                border: "1px solid var(--pd-border)",
                background: hoveredId === problem.id ? "var(--pd-brand-subtle)" : "var(--pd-surface)",
                cursor: "pointer",
                transition: "background 0.12s, border-color 0.12s",
                borderColor: hoveredId === problem.id ? "var(--pd-brand)" : "var(--pd-border)",
              }}
            >
              {/* Difficulty dot */}
              <div
                className="imd-diff-dot"
                style={{
                  background:
                    problem.difficulty === "easy"
                      ? "var(--pd-sim-ok)"
                      : problem.difficulty === "medium"
                      ? "var(--pd-sim-warn)"
                      : "var(--pd-sim-error)",
                  flexShrink: 0,
                }}
              />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="imd-problem-title"
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--pd-text)",
                    marginBottom: 3,
                  }}
                >
                  {problem.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--pd-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {problem.keyChallenge}
                </div>
              </div>

              {/* Tags */}
              <div
                className="imd-problem-tags"
                style={{ display: "flex", gap: 4, flexShrink: 0 }}
              >
                {problem.tags.slice(0, 2).map((t) => (
                  <span key={t} className="imd-tag" style={{ fontSize: 10 }}>
                    {t}
                  </span>
                ))}
              </div>

              {/* Duration */}
              <div
                className="imd-problem-time"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--pd-text-muted)",
                  minWidth: 36,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {problem.durationMins}m
              </div>

              {/* Arrow */}
              <span style={{ color: "var(--pd-text-subtle)", fontSize: 16, flexShrink: 0 }}>
                →
              </span>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--pd-text-muted)" }}>
            No problems match the selected filters.
          </div>
        )}
      </div>
    </main>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  cssClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  cssClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={active && cssClass ? cssClass : undefined}
      style={{
        padding: "4px 12px",
        borderRadius: "var(--pd-radius-full)",
        border: `1px solid ${active ? "var(--pd-brand)" : "var(--pd-border)"}`,
        background: active ? "var(--pd-brand)" : "transparent",
        color: active ? "#fff" : "var(--pd-text-muted)",
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        textTransform: "capitalize",
      }}
    >
      {label}
    </button>
  );
}
