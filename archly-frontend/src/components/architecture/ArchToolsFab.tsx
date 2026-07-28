"use client";

import type { CSSProperties } from "react";
import {
  useArchitectureStudioStore,
  type ArchOverlay,
} from "@/store/architecture-studio.store";

const TOOLS: { id: Exclude<ArchOverlay, null> | "gallery"; label: string; hint: string }[] = [
  { id: "critique", label: "Critique", hint: "Staff review" },
  { id: "blast", label: "Blast", hint: "Failure radius" },
  { id: "constraints", label: "Rules", hint: "Constraints" },
  { id: "cost", label: "Cost", hint: "Ghost $ / RPS" },
  { id: "eras", label: "Eras", hint: "Time travel" },
  { id: "gallery", label: "Forks", hint: "Gallery" },
];

/**
 * Compact Arch tools cluster — bottom-left above Lint / Story.
 */
export default function ArchToolsFab({ lifted = false }: { lifted?: boolean }) {
  const overlay = useArchitectureStudioStore((s) => s.overlay);
  const galleryOpen = useArchitectureStudioStore((s) => s.galleryOpen);
  const toggleOverlay = useArchitectureStudioStore((s) => s.toggleOverlay);
  const setGalleryOpen = useArchitectureStudioStore((s) => s.setGalleryOpen);

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: lifted ? "calc(var(--pd-simbar-height) + 132px)" : 132,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          maxWidth: 220,
          padding: 6,
          borderRadius: 12,
          border: "1px solid var(--pd-border)",
          background: "var(--pd-surface)",
          boxShadow: "var(--pd-shadow)",
        }}
      >
        {TOOLS.map((t) => {
          const active =
            t.id === "gallery" ? galleryOpen : overlay === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => {
                if (t.id === "gallery") {
                  setGalleryOpen(!galleryOpen);
                  return;
                }
                setGalleryOpen(false);
                toggleOverlay(t.id);
              }}
              style={{
                ...chip,
                background: active
                  ? "color-mix(in srgb, var(--pd-brand) 16%, transparent)"
                  : "transparent",
                borderColor: active
                  ? "color-mix(in srgb, var(--pd-brand) 40%, var(--pd-border))"
                  : "transparent",
                color: active ? "var(--pd-brand)" : "var(--pd-text-muted)",
                fontWeight: active ? 800 : 600,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const chip: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 8,
  border: "1px solid transparent",
  fontSize: 11,
  cursor: "pointer",
};
