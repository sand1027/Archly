"use client";

import {
  ARCHITECTURE_GALLERY,
  downloadArchitectureJson,
} from "@/lib/architecture/architecture-gallery";
import { useArchitectureStudioStore } from "@/store/architecture-studio.store";
import { useFlowStore } from "@/store/flow.store";
import { toast } from "@/store/toast.store";

export default function ArchitectureGalleryModal() {
  const open = useArchitectureStudioStore((s) => s.galleryOpen);
  const setGalleryOpen = useArchitectureStudioStore((s) => s.setGalleryOpen);
  const loadGraph = useFlowStore((s) => s.loadGraph);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        background: "color-mix(in srgb, var(--pd-bg) 55%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
      onClick={() => setGalleryOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "min(560px, 100%)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          border: "1px solid var(--pd-border)",
          background: "var(--pd-surface-raised)",
          boxShadow: "var(--pd-shadow)",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--pd-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Architecture forks</div>
            <div style={{ fontSize: 12, color: "var(--pd-text-subtle)" }}>Curated starters — fork, then twist</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                downloadArchitectureJson("my-architecture", nodes, edges);
                toast("Downloaded JSON", "success");
              }}
              disabled={!nodes.length}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--pd-border)", background: "var(--pd-surface)", fontSize: 11, fontWeight: 700, cursor: nodes.length ? "pointer" : "not-allowed" }}
            >
              Publish your twist
            </button>
            <button type="button" onClick={() => setGalleryOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--pd-border)", background: "var(--pd-surface)", cursor: "pointer" }}>✕</button>
          </div>
        </div>
        <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {ARCHITECTURE_GALLERY.map((arch) => (
            <button
              key={arch.id}
              type="button"
              onClick={() => {
                const g = arch.build();
                loadGraph(g.nodes, g.edges);
                setGalleryOpen(false);
                toast(`Forked “${arch.title}”`, "success");
              }}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--pd-border)",
                background: "var(--pd-surface)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--pd-text)" }}>{arch.title}</span>
              <span style={{ fontSize: 11, color: "var(--pd-text-muted)", lineHeight: 1.4 }}>{arch.blurb}</span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {arch.tags.map((t) => (
                  <span key={t} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "var(--pd-bg-muted)", color: "var(--pd-text-subtle)" }}>{t}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
