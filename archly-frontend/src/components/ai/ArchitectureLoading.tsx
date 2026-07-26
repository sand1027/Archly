"use client";

import { useEffect, useMemo, useState } from "react";

/** Rotating status lines while architecture is streaming (no Mermaid dump). */
export const ARCH_LOADING_MESSAGES = [
  "Getting the architecture ready…",
  "Sketching the system boundary…",
  "Placing client apps and edge…",
  "Adding load balancers…",
  "Wiring the API gateway…",
  "Standing up auth services…",
  "Provisioning databases…",
  "Warming Redis caches…",
  "Connecting Kafka topics…",
  "Spinning up worker fleets…",
  "Attaching the CDN…",
  "Routing search and recommendations…",
  "Hooking up object storage…",
  "Configuring observability…",
  "Adding Prometheus scrapes…",
  "Drawing service-to-service edges…",
  "Labeling protocols on arrows…",
  "Checking for single points of failure…",
  "Balancing read and write paths…",
  "Almost done — laying out the graph…",
] as const;

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface Props {
  active?: boolean;
  /** Shown under the rotating line, e.g. the user prompt */
  hint?: string | null;
}

export default function ArchitectureLoading({ active = true, hint }: Props) {
  const order = useMemo(() => shuffle(ARCH_LOADING_MESSAGES), []);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (!active) return;
    setIndex(0);
    setFade(true);
    const id = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % order.length);
        setFade(true);
      }, 160);
    }, 2200);
    return () => window.clearInterval(id);
  }, [active, order]);

  if (!active) return null;

  const message = order[index] ?? ARCH_LOADING_MESSAGES[0];

  return (
    <div
      className="arch-loading"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        padding: "16px 14px",
        borderRadius: "var(--pd-radius-lg)",
        border: "1px solid var(--pd-border)",
        background: "var(--pd-bg-subtle)",
      }}
    >
      {/* Bouncing dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--pd-brand)",
              animation: `arch-dot-bounce 1.1s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(4px)",
          transition: "opacity 160ms ease, transform 160ms ease",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--pd-text)",
          lineHeight: 1.4,
          minHeight: 20,
        }}
      >
        {message}
      </div>

      {hint && (
        <div
          style={{
            fontSize: 11,
            color: "var(--pd-text-subtle)",
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
          title={hint}
        >
          Building: {hint}
        </div>
      )}

      {/* Soft progress shimmer */}
      <div
        style={{
          width: "100%",
          height: 3,
          borderRadius: 99,
          background: "var(--pd-bg-muted)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "40%",
            borderRadius: 99,
            background: "linear-gradient(90deg, transparent, var(--pd-brand), transparent)",
            animation: "arch-shimmer 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
