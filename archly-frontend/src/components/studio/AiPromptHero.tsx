"use client";

import { useState, useRef, useEffect } from "react";
import ModelSelect from "@/components/ai/ModelSelect";
import {
  readStoredAiProvider,
  storeAiProvider,
  type AiProvider,
} from "@/lib/ai/providers";

export const STUDIO_EXAMPLES = [
  { id: "unacademy", label: "Unacademy", prompt: "Design Unacademy production system architecture" },
  { id: "netflix", label: "Netflix", prompt: "Design Netflix video streaming architecture" },
  { id: "stripe", label: "Stripe", prompt: "Design Stripe-scale payment processing architecture" },
  { id: "uber", label: "Uber", prompt: "Design Uber ride-sharing system architecture" },
] as const;

interface Props {
  visible: boolean;
  onSubmit: (prompt: string, provider: AiProvider) => void;
  onOpenFullAi?: () => void;
}

export default function AiPromptHero({ visible, onSubmit, onOpenFullAi }: Props) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<AiProvider>("groq");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProvider(readStoredAiProvider("groq"));
  }, []);

  if (!visible) return null;

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed, provider);
  };

  return (
    <div
      className="ai-prompt-hero"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px 16px 20px",
        background:
          "linear-gradient(to top, color-mix(in srgb, var(--pd-bg) 92%, transparent) 55%, transparent)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(640px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "stretch",
          pointerEvents: "auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--pd-brand)",
              marginBottom: 4,
            }}
          >
            Archly
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--pd-text-muted)",
              lineHeight: 1.4,
            }}
          >
            Describe a system — AI builds it on Flow
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: 8,
            borderRadius: "var(--pd-radius-lg)",
            border: "1px solid var(--pd-border)",
            background: "var(--pd-surface)",
            boxShadow: "var(--pd-shadow-lg)",
            position: "relative",
          }}
        >
          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(prompt);
            }}
            placeholder="e.g. Design Unacademy production architecture…"
            className="pd-input"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              boxShadow: "none",
              fontSize: 14,
              padding: "8px 10px",
            }}
          />
          <ModelSelect
            value={provider}
            onChange={(p) => {
              setProvider(p);
              storeAiProvider(p);
            }}
            align="right"
          />
          <button
            type="button"
            onClick={() => submit(prompt)}
            disabled={!prompt.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--pd-radius)",
              border: "none",
              background: prompt.trim() ? "var(--pd-brand)" : "var(--pd-bg-muted)",
              color: prompt.trim() ? "#fff" : "var(--pd-text-subtle)",
              fontWeight: 700,
              fontSize: 13,
              cursor: prompt.trim() ? "pointer" : "default",
              flexShrink: 0,
            }}
          >
            Generate
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {STUDIO_EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setPrompt(ex.prompt);
                submit(ex.prompt);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--pd-radius-full)",
                border: "1px solid var(--pd-border)",
                background: "var(--pd-surface)",
                color: "var(--pd-text)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "var(--pd-shadow-sm)",
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {onOpenFullAi && (
          <button
            type="button"
            onClick={onOpenFullAi}
            style={{
              alignSelf: "center",
              background: "none",
              border: "none",
              color: "var(--pd-text-subtle)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Open AI panel
          </button>
        )}
      </div>
    </div>
  );
}
