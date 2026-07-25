"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  AI_PROVIDER_OPTIONS,
  providerIconLetter,
  storeAiProvider,
  type AiProvider,
} from "@/lib/ai/providers";

interface ModelSelectProps {
  value: AiProvider;
  onChange: (value: AiProvider) => void;
  disabled?: boolean;
}

export default function ModelSelect({
  value,
  onChange,
  disabled = false,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    AI_PROVIDER_OPTIONS.find((option) => option.value === value) ??
    AI_PROVIDER_OPTIONS[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Select AI model"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span style={sparkStyle}>✦</span>
        <span>{selected.label}</span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 9,
            color: "var(--pd-text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 140ms ease",
          }}
        >
          ▾
        </span>
      </button>

      {open && !disabled && (
        <div role="listbox" aria-label="AI models" style={menuStyle}>
          <div style={menuLabelStyle}>Choose model</div>
          {AI_PROVIDER_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value || "auto"}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  storeAiProvider(option.value);
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  ...optionStyle,
                  background: active
                    ? "var(--pd-brand-subtle)"
                    : "transparent",
                }}
              >
                <span
                  style={{
                    ...modelIconStyle,
                    color: active ? "var(--pd-brand)" : "var(--pd-text-muted)",
                  }}
                >
                  {providerIconLetter(option.value)}
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span
                    style={{
                      display: "block",
                      color: active ? "var(--pd-brand)" : "var(--pd-text)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {option.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 1,
                      color: "var(--pd-text-muted)",
                      fontSize: 10.5,
                    }}
                  >
                    {option.description}
                  </span>
                </span>
                {active && (
                  <span style={{ color: "var(--pd-brand)", fontWeight: 800 }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 28,
  padding: "4px 8px",
  border: "1px solid var(--pd-border)",
  borderRadius: "var(--pd-radius-full)",
  background: "var(--pd-surface)",
  color: "var(--pd-text)",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 700,
  boxShadow: "var(--pd-shadow-sm)",
};

const sparkStyle: CSSProperties = {
  color: "var(--pd-brand)",
  fontSize: 12,
  lineHeight: 1,
};

const menuStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  bottom: "calc(100% + 7px)",
  zIndex: 30,
  width: 240,
  padding: 6,
  border: "1px solid var(--pd-border)",
  borderRadius: 12,
  background: "var(--pd-surface-raised)",
  boxShadow: "var(--pd-shadow)",
};

const menuLabelStyle: CSSProperties = {
  padding: "4px 7px 6px",
  color: "var(--pd-text-muted)",
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const optionStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px",
  border: "none",
  borderRadius: 8,
  fontFamily: "inherit",
  cursor: "pointer",
};

const modelIconStyle: CSSProperties = {
  width: 25,
  height: 25,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  border: "1px solid var(--pd-border)",
  borderRadius: 7,
  background: "var(--pd-bg-muted)",
  fontSize: 10,
  fontWeight: 800,
};
