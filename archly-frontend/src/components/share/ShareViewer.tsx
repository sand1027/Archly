"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ReactFlow, Background, BackgroundVariant, Controls, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { shareApi } from "@/lib/api/endpoints";
import { useTheme } from "@/providers/theme-provider";
import FlowNode from "@/components/flow/FlowNode";
import FlowEdge from "@/components/flow/FlowEdge";

const ExcalidrawReadonly = dynamic(
  () => import("@excalidraw/excalidraw").then(async (mod) => {
    const { Excalidraw } = mod;
    function Viewer({ elements }: { elements: unknown[] }) {
      return (
        <div style={{ width: "100%", height: "100%" }}>
          <Excalidraw
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialData={{ elements: elements as any[], appState: { viewModeEnabled: true } }}
            viewModeEnabled
            zenModeEnabled
            UIOptions={{ canvasActions: { loadScene: false, export: false, saveToActiveFile: false } }}
          />
        </div>
      );
    }
    return Viewer;
  }),
  { ssr: false, loading: () => <LoadingLabel text="Loading canvas…" /> }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES = { flowNode: FlowNode as any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EDGE_TYPES = { flowEdge: FlowEdge as any };

interface Props {
  slug: string;
  embed?: boolean;
}

type Kind = "flow" | "canvas" | "unknown";

function detectKind(elements: unknown, appState: unknown): Kind {
  if (elements && typeof elements === "object" && !Array.isArray(elements)) {
    const e = elements as { nodes?: unknown[]; edges?: unknown[] };
    if (Array.isArray(e.nodes)) return "flow";
  }
  if (Array.isArray(elements) && elements.length > 0) {
    const first = elements[0] as { type?: string; position?: unknown };
    if (first?.position && typeof first.position === "object") return "flow";
    if (first?.type) return "canvas";
  }
  const as = appState as { kind?: string } | null;
  if (as?.kind === "flow") return "flow";
  if (as?.kind === "canvas") return "canvas";
  return "unknown";
}

function LoadingLabel({ text }: { text: string }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--pd-text-muted)", fontSize: 13,
    }}>{text}</div>
  );
}

export default function ShareViewer({ slug, embed }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elements, setElements] = useState<unknown>(null);
  const [appState, setAppState] = useState<unknown>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await shareApi.resolve(slug);
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        setElements(d.elements ?? null);
        setAppState(d.app_state ?? d.appState ?? null);
        setExpiresAt(d.expires_at ?? d.expiresAt ?? null);
      } catch {
        if (!cancelled) setError("This share link is invalid or has expired.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const kind = useMemo(() => detectKind(elements, appState), [elements, appState]);

  const flowGraph = useMemo(() => {
    if (kind !== "flow" || !elements) return { nodes: [], edges: [] };
    if (Array.isArray(elements)) {
      // unlikely: nodes array alone
      return { nodes: elements as never[], edges: [] };
    }
    const e = elements as { nodes?: unknown[]; edges?: unknown[] };
    return {
      nodes: (e.nodes ?? []) as never[],
      edges: (e.edges ?? []) as never[],
    };
  }, [kind, elements]);

  if (loading) {
    return (
      <Shell embed={embed} slug={slug}>
        <LoadingLabel text="Loading shared design…" />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell embed={embed} slug={slug}>
        <div style={{ textAlign: "center", padding: 32, maxWidth: 400, margin: "0 auto" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--pd-text)", margin: "0 0 8px" }}>
            Link unavailable
          </h1>
          <p style={{ color: "var(--pd-text-muted)", fontSize: 14, margin: "0 0 16px" }}>{error}</p>
          {!embed && (
            <Link href="/canvas" style={{ color: "var(--pd-brand)", fontWeight: 700, fontSize: 13 }}>
              Open Archly
            </Link>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell embed={embed} slug={slug} expiresAt={expiresAt} kind={kind}>
      <div style={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
        {kind === "flow" && (
          <ReactFlowProvider>
            <ReactFlow
              nodes={flowGraph.nodes}
              edges={flowGraph.edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
              style={{ width: "100%", height: "100%", background: "var(--pd-bg)" }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--pd-border)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
        {kind === "canvas" && Array.isArray(elements) && (
          <ExcalidrawReadonly elements={elements} />
        )}
        {kind === "unknown" && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--pd-text-muted)" }}>
            Shared design has no renderable content.
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  embed,
  slug,
  expiresAt,
  kind,
}: {
  children: React.ReactNode;
  embed?: boolean;
  slug: string;
  expiresAt?: string | null;
  kind?: Kind;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={embed ? "share-embed" : "share-page"}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--pd-bg)",
        color: "var(--pd-text)",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
      }}
    >
      {!embed && (
        <header
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--pd-border)",
            background: "var(--pd-surface)",
            flexWrap: "wrap",
          }}
        >
          <Link href="/canvas" aria-label="Archly" style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/brand-navbar.png"
              alt="Archly"
              height={22}
              width={88}
              draggable={false}
              style={{
                height: 22,
                width: "auto",
                display: "block",
                filter: isDark ? undefined : "invert(1) hue-rotate(180deg)",
              }}
            />
          </Link>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Shared design
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--pd-text-muted)" }}>
              {kind === "flow" ? "Flow diagram" : kind === "canvas" ? "Canvas sketch" : "Read-only"}
              {expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : ""}
              {" · "}
              <code style={{ fontSize: 11 }}>{slug}</code>
            </p>
          </div>
          <Link
            href="/canvas"
            style={{
              padding: "8px 14px",
              borderRadius: "var(--pd-radius-full)",
              background: "var(--pd-brand)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Open in Archly
          </Link>
        </header>
      )}
      {embed && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            zIndex: 10,
            padding: "4px 8px",
            borderRadius: "var(--pd-radius)",
            background: "color-mix(in srgb, var(--pd-surface) 90%, transparent)",
            border: "1px solid var(--pd-border)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--pd-text-muted)",
          }}
        >
          Archly
        </div>
      )}
      {children}
    </div>
  );
}
