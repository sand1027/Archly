"use client";

import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { mergePromotedGraph } from "@/lib/architecture/promote-freehand-to-flow";
import { useFlowStore } from "@/store/flow.store";
import { useCanvasStore } from "@/store/canvas.store";
import { toast } from "@/store/toast.store";

/** Freehand → Flow promote CTA */
export default function PromoteToFlowButton({ onDone }: { onDone: () => void }) {
  const loadGraph = useFlowStore((s) => s.loadGraph);
  const flowNodes = useFlowStore((s) => s.nodes);
  const flowEdges = useFlowStore((s) => s.edges);

  return (
    <button
      type="button"
      title="Promote Freehand components into Flow nodes"
      onClick={() => {
        const api = getExcalidrawAPI();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const els = (api?.getSceneElements?.() as any[]) ?? useCanvasStore.getState().elements;
        const result = mergePromotedGraph(flowNodes, flowEdges, els ?? []);
        if (!result.promoted) {
          toast("No component stickers to promote — drop palette items first", "warn");
          return;
        }
        loadGraph(result.nodes, result.edges);
        toast(`Promoted ${result.promoted} node${result.promoted === 1 ? "" : "s"} to Flow`, "success");
        onDone();
      }}
      style={{
        position: "absolute",
        left: 12,
        bottom: 16,
        zIndex: 80,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--pd-brand) 28%, var(--pd-border))",
        background: "var(--pd-surface)",
        boxShadow: "var(--pd-shadow)",
        cursor: "pointer",
        color: "var(--pd-text)",
        fontFamily: "var(--ui-font, Assistant, sans-serif)",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      Promote to Flow →
    </button>
  );
}
