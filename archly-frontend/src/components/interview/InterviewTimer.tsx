"use client";

import { useEffect, useState, useCallback } from "react";
import type { InterviewStatus } from "@/types";

interface InterviewTimerProps {
  durationMins: number;
  status: InterviewStatus;
  onEnd: () => void;
}

export default function InterviewTimer({
  durationMins,
  status,
  onEnd,
}: InterviewTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationMins * 60);

  useEffect(() => {
    setSecondsLeft(durationMins * 60);
  }, [durationMins]);

  useEffect(() => {
    if (status !== "active") return;

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, onEnd]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = secondsLeft / (durationMins * 60);

  const color =
    pct < 0.2
      ? "var(--pd-sim-error)"
      : pct < 0.4
      ? "var(--pd-sim-warn)"
      : "var(--pd-sim-ok)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 14px",
        borderRadius: "var(--pd-radius)",
        background: "var(--pd-bg-muted)",
        border: "1px solid var(--pd-border)",
      }}
    >
      <span style={{ fontSize: 14 }}>⏱</span>
      <span
        style={{
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          fontSize: 18,
          color,
          minWidth: 56,
          textAlign: "center",
          letterSpacing: "0.05em",
        }}
      >
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
      {/* Bar */}
      <div
        style={{
          width: 80,
          height: 4,
          borderRadius: 2,
          background: "var(--pd-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            transition: "width 1s linear, background 0.5s",
          }}
        />
      </div>
    </div>
  );
}
