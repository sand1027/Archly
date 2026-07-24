"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getProblem } from "@/lib/simulation/scenarios";
import InterviewTimer from "@/components/interview/InterviewTimer";
import dynamic from "next/dynamic";
import type { InterviewStatus } from "@/types";

const ExcalidrawWrapper = dynamic(
  () => import("@/components/canvas/ExcalidrawWrapper"),
  { ssr: false }
);

interface Props {
  params: Promise<{ problemId: string }>;
}

export default function InterviewSessionPage({ params }: Props) {
  const { problemId } = use(params);
  const router = useRouter();
  const problem = getProblem(problemId);

  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [showPrompt, setShowPrompt] = useState(true);

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

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        <ExcalidrawWrapper />

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
          <div className="imd-overlay" style={{ position: "absolute" }}>
            <div className="imd-modal" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: "var(--pd-text)" }}>
                Interview Complete!
              </h2>
              <p style={{ color: "var(--pd-text-muted)", marginBottom: 24 }}>
                {problem.title} · {problem.durationMins} minutes
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  onClick={() => router.push("/interview")}
                  style={{
                    padding: "10px 24px",
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
                  onClick={() => router.push("/canvas")}
                  style={{
                    padding: "10px 24px",
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
        )}
      </div>
    </div>
  );
}
