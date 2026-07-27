"use client";

import { useState, type CSSProperties } from "react";
import { useFlowStore } from "@/store/flow.store";
import { useCanvasStore } from "@/store/canvas.store";
import { useSchemaStore } from "@/store/schema.store";
import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { schemaToMermaid, schemaToSql } from "@/lib/schema/schema-to-sql";
import type { DesignKind } from "@/types";

type ExportKind = DesignKind | "schema";

interface ExportMenuProps {
  isOpen: boolean;
  onClose: () => void;
  kind: ExportKind;
}

function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function mermaidId(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");
  return cleaned || fallback;
}

function serializeFlowToMermaid(
  nodes: { id: string; data?: { label?: string } }[],
  edges: { source: string; target: string }[]
): string {
  const lines = ["flowchart TD"];
  for (const n of nodes) {
    const id = mermaidId(n.id, "n");
    const label = String(n.data?.label ?? n.id).replace(/"/g, "'");
    lines.push(`  ${id}["${label}"]`);
  }
  for (const e of edges) {
    lines.push(`  ${mermaidId(e.source, "a")} --> ${mermaidId(e.target, "b")}`);
  }
  return lines.join("\n") + "\n";
}

function serializeCanvasToMermaid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[]
): string {
  const nodes = elements.filter(
    (e) => e && !e.isDeleted && (e.type === "rectangle" || e.type === "diamond" || e.type === "ellipse")
  );
  const arrows = elements.filter((e) => e && !e.isDeleted && e.type === "arrow");

  const lines = ["flowchart TD"];
  const idMap = new Map<string, string>();

  nodes.forEach((n, i) => {
    const mid = mermaidId(String(n.id), `n${i}`);
    idMap.set(String(n.id), mid);
    const label = String(
      n.customData?.label ?? n.label ?? n.id ?? `Node ${i + 1}`
    ).replace(/"/g, "'");
    lines.push(`  ${mid}["${label}"]`);
  });

  for (const a of arrows) {
    const startId = a.startBinding?.elementId;
    const endId = a.endBinding?.elementId;
    if (!startId || !endId) continue;
    const from = idMap.get(String(startId));
    const to = idMap.get(String(endId));
    if (from && to) lines.push(`  ${from} --> ${to}`);
  }

  if (lines.length === 1) {
    lines.push('  empty["Empty canvas"]');
  }

  return lines.join("\n") + "\n";
}

export default function ExportMenu({ isOpen, onClose, kind }: ExportMenuProps) {
  const [msg, setMsg] = useState<string | null>(null);
  const flowNodes = useFlowStore((s) => s.nodes);
  const flowEdges = useFlowStore((s) => s.edges);
  const canvasElements = useCanvasStore((s) => s.elements);
  const schemaNodes = useSchemaStore((s) => s.nodes);
  const schemaEdges = useSchemaStore((s) => s.edges);

  if (!isOpen) return null;

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 3500);
  };

  const exportMermaid = () => {
    let text: string;
    if (kind === "schema") {
      text = schemaToMermaid(schemaNodes, schemaEdges);
    } else if (kind === "flow") {
      text = serializeFlowToMermaid(flowNodes, flowEdges);
    } else {
      const api = getExcalidrawAPI();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const els = (api?.getSceneElements?.() as any[]) ?? canvasElements;
      text = serializeCanvasToMermaid(els);
    }
    downloadText(`archly-${kind}.mmd`, text, "text/plain");
    flash("Downloaded Mermaid (.mmd)");
  };

  const exportSql = () => {
    const text = schemaToSql(schemaNodes, schemaEdges);
    downloadText("archly-schema.sql", text, "text/sql");
    flash("Downloaded SQL (.sql)");
  };

  const exportPng = async () => {
    try {
      if (kind === "flow" || kind === "schema") {
        const viewport =
          document.querySelector(".react-flow__viewport") as HTMLElement | null;
        const canvas = document.querySelector(
          ".react-flow__renderer canvas, .react-flow canvas"
        ) as HTMLCanvasElement | null;

        if (canvas && typeof canvas.toDataURL === "function") {
          const dataUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = "archly-flow.png";
          a.click();
          flash("Downloaded PNG");
          return;
        }

        // Fallback: try cloning viewport via foreignObject is unreliable —
        // offer Mermaid + screenshot tip
        if (viewport) {
          flash("PNG via browser screenshot — Mermaid export also available");
          exportMermaid();
          return;
        }
        flash("PNG unavailable — downloaded Mermaid instead");
        exportMermaid();
        return;
      }

      // Excalidraw
      const api = getExcalidrawAPI();
      if (api?.exportToBlob) {
        const elements = api.getSceneElements?.() ?? [];
        const appState = api.getAppState?.() ?? {};
        const files = api.getFiles?.() ?? {};
        const blob = await api.exportToBlob({
          elements,
          appState: { ...appState, exportBackground: true },
          files,
          mimeType: "image/png",
        });
        downloadBlob("archly-canvas.png", blob);
        flash("Downloaded PNG");
        return;
      }

      // Dynamic import of @excalidraw/excalidraw export helpers
      try {
        const excalidraw = await import("@excalidraw/excalidraw");
        const exportToBlob = (excalidraw as { exportToBlob?: (opts: unknown) => Promise<Blob> }).exportToBlob;
        if (exportToBlob && api) {
          const blob = await exportToBlob({
            elements: api.getSceneElements?.() ?? [],
            appState: { ...(api.getAppState?.() ?? {}), exportBackground: true },
            files: api.getFiles?.() ?? {},
            mimeType: "image/png",
          });
          downloadBlob("archly-canvas.png", blob);
          flash("Downloaded PNG");
          return;
        }
      } catch {
        // fall through
      }

      flash("PNG via browser screenshot — exporting Mermaid instead");
      exportMermaid();
    } catch {
      flash("PNG failed — exporting Mermaid instead");
      exportMermaid();
    }
  };

  const exportSvg = async () => {
    if (kind === "flow") {
      flash("SVG export is available for Canvas (Excalidraw). Use Mermaid for Flow.");
      return;
    }
    try {
      const api = getExcalidrawAPI();
      if (api?.exportToSvg) {
        const svg = await api.exportToSvg({
          elements: api.getSceneElements?.() ?? [],
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
        const serializer = new XMLSerializer();
        const text = serializer.serializeToString(svg);
        downloadText("archly-canvas.svg", text, "image/svg+xml");
        flash("Downloaded SVG");
        return;
      }

      const excalidraw = await import("@excalidraw/excalidraw");
      const exportToSvg = (excalidraw as { exportToSvg?: (opts: unknown) => Promise<SVGSVGElement> }).exportToSvg;
      if (exportToSvg && api) {
        const svg = await exportToSvg({
          elements: api.getSceneElements?.() ?? [],
          appState: api.getAppState?.() ?? {},
          files: api.getFiles?.() ?? {},
        });
        const serializer = new XMLSerializer();
        const text = serializer.serializeToString(svg);
        downloadText("archly-canvas.svg", text, "image/svg+xml");
        flash("Downloaded SVG");
        return;
      }

      flash("SVG export unavailable — try Mermaid or PNG");
    } catch {
      flash("SVG export failed");
    }
  };

  return (
    <div role="presentation" onClick={onClose} style={overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-menu-title"
        onClick={(e) => e.stopPropagation()}
        style={card}
      >
        <div style={header}>
          <h2 id="export-menu-title" style={titleStyle}>
            Export {kind === "schema" ? "Schema" : kind === "flow" ? "Flow" : "Canvas"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={closeBtn}>
            ✕
          </button>
        </div>

        <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <ExportBtn
            label={kind === "schema" ? "Export erDiagram" : "Export Mermaid"}
            desc={
              kind === "schema"
                ? "Download Mermaid ERD as .mmd"
                : "Download flowchart as .mmd"
            }
            onClick={exportMermaid}
          />
          {kind === "schema" && (
            <ExportBtn
              label="Export SQL"
              desc="CREATE TABLE + FK constraints (.sql)"
              onClick={exportSql}
            />
          )}
          <ExportBtn
            label="Export PNG"
            desc={
              kind === "flow" || kind === "schema"
                ? "Capture viewport (falls back to Mermaid)"
                : "Export via Excalidraw API"
            }
            onClick={() => void exportPng()}
          />
          {kind === "canvas" && (
            <ExportBtn
              label="Export SVG"
              desc="Vector export via Excalidraw"
              onClick={() => void exportSvg()}
            />
          )}
          {msg && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--pd-brand)", fontWeight: 600 }}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportBtn({
  label,
  desc,
  onClick,
}: {
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={exportBtn}>
      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--pd-text)" }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--pd-text-muted)" }}>{desc}</span>
    </button>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 400,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(380px, 100%)",
  background: "var(--pd-surface-raised)",
  border: "1px solid var(--pd-border)",
  borderRadius: "var(--pd-radius-lg, 12px)",
  boxShadow: "var(--pd-shadow)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid var(--pd-border)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 800,
  color: "var(--pd-text)",
};

const closeBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
};

const exportBtn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: "10px 12px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-bg)",
  cursor: "pointer",
  textAlign: "left",
};
