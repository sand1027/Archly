"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "archly-onboarding-v1";

const STEPS = [
  {
    title: "Generate",
    body: "Describe a system (or tap Unacademy / Netflix / Stripe). Archly AI lays out a Flow architecture.",
  },
  {
    title: "Simulate",
    body: "Switch to Simulate mode, press Play, and watch traffic metrics across nodes.",
  },
  {
    title: "Chaos",
    body: "Inject Crash, Slow, Surge… on a node. Watch colors, edges, and metrics respond.",
  },
] as const;

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function OnboardingTour({ forceOpen, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [forceOpen]);

  if (!open) return null;

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    onClose?.();
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <div
        onClick={finish}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 280,
          background: "rgba(15, 15, 20, 0.45)",
        }}
      />
      <div
        className="onboarding-tour"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 290,
          width: "min(400px, calc(100vw - 32px))",
          padding: 24,
          borderRadius: "var(--pd-radius-lg)",
          background: "var(--pd-surface)",
          border: "1px solid var(--pd-border)",
          boxShadow: "var(--pd-shadow-lg)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--pd-brand)",
            marginBottom: 8,
          }}
        >
          Step {step + 1} of {STEPS.length}
        </div>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 800,
            color: "var(--pd-text)",
            letterSpacing: "-0.02em",
          }}
        >
          {current.title}
        </h3>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--pd-text-muted)",
          }}
        >
          {current.body}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={finish}
            style={{
              padding: "8px 12px",
              border: "none",
              background: "transparent",
              color: "var(--pd-text-subtle)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              marginRight: "auto",
            }}
          >
            Skip
          </button>
          {!last ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--pd-radius)",
                border: "none",
                background: "var(--pd-brand)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--pd-radius)",
                border: "none",
                background: "var(--pd-brand)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Start designing
            </button>
          )}
        </div>
      </div>
    </>
  );
}
