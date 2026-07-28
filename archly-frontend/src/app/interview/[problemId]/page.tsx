"use client";

import { use, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getProblem } from "@/lib/simulation/scenarios";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ComponentPalette from "@/components/canvas/ComponentPalette";
import dynamic from "next/dynamic";
import type { InterviewStatus } from "@/types";
import { useFlowStore } from "@/store/flow.store";
import {
  freehandRubricTips,
  scoreInterviewFlow,
} from "@/lib/architecture/interview-rubric";

const ExcalidrawWrapper = dynamic(
  () => import("@/components/canvas/ExcalidrawWrapper"),
  { ssr: false }
);

const FlowCanvas = dynamic(() => import("@/components/flow/FlowCanvas"), {
  ssr: false,
});

interface Props {
  params: Promise<{ problemId: string }>;
}

type CanvasMode = "flow" | "freehand";

export default function InterviewSessionPage({ params }: Props) {
  const { problemId } = use(params);
  const router = useRouter();
  const problem = getProblem(problemId);

  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [showPrompt, setShowPrompt] = useState(true);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("flow");

  const handleEnd = useCallback(() => {
    setStatus("ended");
  }, []);

  const handleStart = useCallback(() => {
    setStatus("active");
    setShowPrompt(false);
  }, []);

  if (!problem) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--pd-bg)",
          fontFamily: "Assistant, sans-serif",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>❓</div>
        <div style={{ fontWeight: 700, color: "var(--pd-text)" }}>
          Problem not found: {problemId}
        </div>
        <button
          onClick={() => router.push("/interview")}
          style={{
            padding: "8px 20px",
            borderRadius: "var(--pd-radius)",
            background: "var(--pd-brand)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          ← Back to problems
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--pd-bg)",
        fontFamily: "Assistant, sans-serif",
      }}
    >
      {/* Interview top bar */}
      <div
        style={{
          height: 52,
          background: "var(--pd-toolbar-bg)",
          borderBottom: "1px solid var(--pd-toolbar-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Problem title */}
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--pd-text)" }}>
          🎓 {problem.title}
        </div>

        {/* Difficulty */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "var(--pd-radius-full)",
            fontSize: 11,
            fontWeight: 700,
            background:
              problem.difficulty === "easy"
                ? "rgba(34,197,94,0.1)"
                : problem.difficulty === "medium"
                ? "rgba(245,158,11,0.1)"
                : "rgba(239,68,68,0.1)",
            color:
              problem.difficulty === "easy"
                ? "var(--pd-sim-ok)"
                : problem.difficulty === "medium"
                ? "var(--pd-sim-warn)"
                : "var(--pd-sim-error)",
            textTransform: "capitalize",
          }}
        >
          {problem.difficulty}
        </span>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 3,
            borderRadius: 8,
            border: "1px solid var(--pd-border)",
            background: "var(--pd-surface)",
          }}
        >
          {(["flow", "freehand"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCanvasMode(m)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                background: canvasMode === m ? "var(--pd-brand)" : "transparent",
                color: canvasMode === m ? "#fff" : "var(--pd-text-muted)",
              }}
            >
              {m === "flow" ? "Flow" : "Freehand"}
            </button>
          ))}
        </div>

        {/* Timer */}
        {status !== "idle" && (
          <InterviewTimer
            durationMins={problem.durationMins}
            status={status}
            onEnd={handleEnd}
          />
        )}

        {/* Controls */}
        {status === "idle" && (
          <button
            onClick={handleStart}
            className="imd-start-btn"
            style={{
              padding: "7px 18px",
              borderRadius: "var(--pd-radius)",
              background: "var(--pd-brand)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ▶ Start Interview
          </button>
        )}
        {status === "active" && (
          <button
            onClick={() => setStatus("paused")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "transparent",
              color: "var(--pd-text-muted)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ⏸ Pause
          </button>
        )}
        {status === "paused" && (
          <button
            onClick={() => setStatus("active")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--pd-radius)",
              background: "var(--pd-brand)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ▶ Resume
          </button>
        )}
        {(status === "active" || status === "paused") && (
          <button
            onClick={handleEnd}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "transparent",
              color: "var(--pd-sim-error)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            End Interview
          </button>
        )}

        {/* Back */}
        <button
          onClick={() => router.push("/interview")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--pd-text-muted)",
            fontSize: 18,
            padding: "2px 6px",
          }}
          title="Back to problem list"
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex" }}>
        {canvasMode === "flow" && <ComponentPalette />}
        <div style={{ flex: 1, position: "relative" }}>
        {canvasMode === "flow" ? <FlowCanvas /> : <ExcalidrawWrapper />}

        {/* Prompt overlay (before start) */}
        {showPrompt && status === "idle" && (
          <div
            className="imd-overlay"
            style={{ position: "absolute" }}
            onClick={() => setShowPrompt(false)}
          >
            <div
              className="imd-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "24px 28px" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--pd-text-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  System Design Interview · {problem.durationMins} minutes
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--pd-text)",
                    marginBottom: 16,
                    lineHeight: 1.3,
                  }}
                >
                  {problem.title}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--pd-text-muted)",
                    lineHeight: 1.7,
                    marginBottom: 20,
                  }}
                >
                  {problem.prompt}
                </p>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--pd-radius)",
                    background: "var(--pd-brand-subtle)",
                    border: "1px solid var(--pd-brand)",
                    fontSize: 13,
                    color: "var(--pd-brand-text)",
                    marginBottom: 24,
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Key challenge:</strong> {problem.keyChallenge}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => router.push("/interview")}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: "var(--pd-radius)",
                      border: "1px solid var(--pd-border)",
                      background: "transparent",
                      color: "var(--pd-text-muted)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ← Pick different problem
                  </button>
                  <button
                    onClick={handleStart}
                    className="imd-start-btn"
                    style={{
                      flex: 2,
                      padding: "10px 0",
                      borderRadius: "var(--pd-radius)",
                      background: "var(--pd-brand)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    ▶ Start {problem.durationMins}-min Interview
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ended overlay */}
        {status === "ended" && (
          <InterviewEndOverlay
            problem={problem}
            canvasMode={canvasMode}
            onNewProblem={() => router.push("/interview")}
            onOpenCanvas={() => router.push("/canvas")}
          />
        )}
        </div>
      </div>
    </div>
  );
}

function InterviewEndOverlay({
  problem,
  canvasMode,
  onNewProblem,
  onOpenCanvas,
}: {
  problem: NonNullable<ReturnType<typeof getProblem>>;
  canvasMode: CanvasMode;
  onNewProblem: () => void;
  onOpenCanvas: () => void;
}) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const autoScore = useMemo(
    () =>
      canvasMode === "flow"
        ? scoreInterviewFlow(nodes, edges)
        : freehandRubricTips(),
    [canvasMode, nodes, edges]
  );

  const rubric = problem.rubric ?? [];
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [selfGrade, setSelfGrade] = useState(3);

  const ticked = rubric.filter((_, i) => checked[i]).length;

  return (
    <div className="imd-overlay" style={{ position: "absolute" }}>
      <div
        className="imd-modal"
        style={{
          textAlign: "left",
          padding: 28,
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--pd-text)" }}>
            Interview Complete!
          </h2>
          <p style={{ color: "var(--pd-text-muted)", margin: 0, fontSize: 13 }}>
            {problem.title} · {problem.durationMins} minutes
          </p>
        </div>

        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid color-mix(in srgb, var(--pd-brand) 30%, var(--pd-border))",
            background: "color-mix(in srgb, var(--pd-brand) 8%, var(--pd-surface))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pd-brand)", marginBottom: 4 }}>
            Theater score · {canvasMode === "flow" ? "Flow" : "Freehand tips"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--pd-text)" }}>
            {autoScore.percent}%
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pd-text-muted)", marginLeft: 8 }}>
              {autoScore.score}/{autoScore.maxScore}
            </span>
          </div>
          {autoScore.oneLiner && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--pd-text-muted)", lineHeight: 1.4 }}>
              {autoScore.oneLiner}
            </p>
          )}
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {autoScore.items.map((item) => (
              <li key={item.id} style={{ fontSize: 12, color: item.passed ? "var(--pd-text)" : "var(--pd-text-muted)" }}>
                {item.passed ? "✓" : "○"} {item.label}
              </li>
            ))}
          </ul>
        </div>

        {rubric.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--pd-text-subtle)",
                marginBottom: 8,
              }}
            >
              Rubric checklist · {ticked}/{rubric.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rubric.map((item, i) => (
                <label
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 13,
                    color: "var(--pd-text)",
                    cursor: "pointer",
                    padding: "6px 8px",
                    borderRadius: "var(--pd-radius)",
                    background: checked[i]
                      ? "color-mix(in srgb, var(--pd-brand) 8%, transparent)"
                      : "var(--pd-bg-muted)",
                    border: "1px solid var(--pd-border)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={(e) =>
                      setChecked((c) => ({ ...c, [i]: e.target.checked }))
                    }
                    style={{ marginTop: 2, accentColor: "var(--pd-brand)" }}
                  />
                  <span style={{ lineHeight: 1.4 }}>{item}</span>
                </label>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--pd-text-subtle)",
                  marginBottom: 6,
                }}
              >
                Self grade · {selfGrade}/5
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelfGrade(n)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: "var(--pd-radius)",
                      border:
                        selfGrade === n
                          ? "1px solid var(--pd-brand)"
                          : "1px solid var(--pd-border)",
                      background:
                        selfGrade === n
                          ? "var(--pd-brand)"
                          : "transparent",
                      color: selfGrade === n ? "#fff" : "var(--pd-text-muted)",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onNewProblem}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "transparent",
              color: "var(--pd-text-muted)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            New Problem
          </button>
          <button
            onClick={onOpenCanvas}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "var(--pd-radius)",
              background: "var(--pd-brand)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Open in Canvas →
          </button>
        </div>
      </div>
    </div>
  );
}
