"use client";

import { useEffect, useState } from "react";
import ModelSelect from "@/components/ai/ModelSelect";
import {
  readStoredAiProvider,
  storeAiProvider,
  type AiProvider,
} from "@/lib/ai/providers";
import { STUDIO_EXAMPLES } from "@/components/studio/AiPromptHero";

interface Props {
  visible: boolean;
  onGenerate: (prompt: string, provider: AiProvider) => void;
  onOpenAi: () => void;
  onOpenSchema?: () => void;
  onOpenGallery?: () => void;
}

/** Centered empty-state for Flow — chips + one generate CTA. */
export default function FlowEmptyHero({ visible, onGenerate, onOpenAi, onOpenSchema, onOpenGallery }: Props) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<AiProvider>("groq");

  useEffect(() => {
    setProvider(readStoredAiProvider("groq"));
  }, []);

  if (!visible) return null;

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onGenerate(trimmed, provider);
  };

  return (
    <div
      className="flow-empty-hero"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 70% 50% at 50% 45%, color-mix(in srgb, var(--pd-bg) 88%, transparent), transparent 70%)",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 14,
          pointerEvents: "auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              marginBottom: 12,
              background: "var(--pd-surface)",
              border: "1px solid var(--pd-border)",
              boxShadow: "var(--pd-shadow-sm)",
              color: "var(--pd-brand)",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            ⌁
          </div>
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--pd-text)",
            }}
          >
            Design your architecture
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--pd-text-muted)",
              lineHeight: 1.45,
            }}
          >
            Drag from the left, or generate a full system with AI
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: 8,
            borderRadius: 12,
            border: "1px solid var(--pd-border)",
            background: "var(--pd-surface)",
            boxShadow: "var(--pd-shadow-lg)",
          }}
        >
          <input
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
              fontSize: 13.5,
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
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: prompt.trim() ? "var(--pd-brand)" : "var(--pd-bg-muted)",
              color: prompt.trim() ? "#fff" : "var(--pd-text-subtle)",
              fontWeight: 700,
              fontSize: 12.5,
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
              onClick={() => submit(ex.prompt)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
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

        <div style={{ display: "flex", gap: 16, alignSelf: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={onOpenAi}
            style={{
              background: "none",
              border: "none",
              color: "var(--pd-text-subtle)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Open full AI panel
          </button>
          {onOpenSchema && (
            <button
              type="button"
              onClick={onOpenSchema}
              style={{
                background: "none",
                border: "none",
                color: "var(--pd-brand)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Need a database schema? → Schema AI
            </button>
          )}
          {onOpenGallery && (
            <button
              type="button"
              onClick={onOpenGallery}
              style={{
                background: "none",
                border: "none",
                color: "var(--pd-brand)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Fork a starter architecture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
