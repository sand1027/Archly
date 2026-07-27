"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useSchemaStore } from "@/store/schema.store";
import { useTheme } from "@/providers/theme-provider";
import SchemaTableNode from "./SchemaTableNode";
import SchemaRelationEdge from "./SchemaRelationEdge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES = { schemaTable: SchemaTableNode as any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EDGE_TYPES = { schemaRelation: SchemaRelationEdge as any };

function SchemaCanvasInner() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addTable,
    setSelectedTableId,
    undo,
    redo,
    fitViewNonce,
  } = useSchemaStore();

  useEffect(() => {
    if (!fitViewNonce || nodes.length === 0) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) fitView({ padding: 0.2, duration: 280, maxZoom: 1.1 });
    };
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fitViewNonce, nodes.length, fitView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const onNodeClick = useCallback(
    (_: unknown, node: { id: string }) => setSelectedTableId(node.id),
    [setSelectedTableId]
  );

  const onPaneClick = useCallback(() => setSelectedTableId(null), [setSelectedTableId]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/archly-schema-table");
      if (!raw) return;
      let payload: {
        tableName?: string;
        columns?: { name: string; type: string; pk?: boolean; unique?: boolean; nullable?: boolean; fk?: { table: string; column: string } | null }[];
      } = {};
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { tableName: "new_table" };
      }
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const columns =
        payload.columns && payload.columns.length > 0
          ? payload.columns
          : [
              { name: "id", type: "uuid", pk: true, nullable: false },
              { name: "created_at", type: "timestamptz", nullable: false },
            ];
      addTable(payload.tableName || "new_table", columns, position);
    },
    [addTable, screenToFlowPosition]
  );

  return (
    <div style={{ flex: 1, width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        style={{ background: "var(--pd-bg)" }}
      >
        <Controls
          showInteractive={false}
          style={{
            background: "var(--pd-surface)",
            border: "1px solid var(--pd-border)",
            borderRadius: 8,
          }}
        />
        <MiniMap
          position="bottom-right"
          nodeColor={() => "#5b5ef4"}
          style={{
            background: "var(--pd-surface)",
            border: "1px solid var(--pd-border)",
            borderRadius: 8,
          }}
          maskColor={isDark ? "rgba(0,0,0,0.4)" : "rgba(240,240,245,0.7)"}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color={isDark ? "#2e2e3d" : "#d4d4dc"}
        />
      </ReactFlow>
    </div>
  );
}

export default function SchemaCanvas() {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner />
    </ReactFlowProvider>
  );
}
