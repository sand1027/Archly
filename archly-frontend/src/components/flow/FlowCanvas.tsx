"use client";

/**
 * FlowCanvas — React Flow-based system design canvas.
 *
 * Features:
 * ┌────────────────────────────────────────────────────────┐
 * │  Drop components from palette → creates FlowNode       │
 * │  Connect nodes by dragging handles → creates FlowEdge  │
 * │  Drop onto an existing edge → smart edge insertion     │
 * │  Live simulation: packets animate along edges          │
 * │  Per-node metrics shown directly on nodes              │
 * │  Right-click node → context menu (delete / chaos)      │
 * │  Delete key → removes selected nodes/edges             │
 * └────────────────────────────────────────────────────────┘
 */

import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
// React Flow styles — imported here since this component is client-only (ssr:false)
import "@xyflow/react/dist/style.css";

import { useFlowStore } from "@/store/flow.store";
import { useSimulationStore } from "@/store/simulation.store";
import { useTheme } from "@/providers/theme-provider";
import { getComponent } from "@/lib/components-registry";
import FlowNode from "./FlowNode";
import GuideNoteNode from "./GuideNoteNode";
import FlowEdge from "./FlowEdge";
import FlowContextMenu from "./FlowContextMenu";
import FlowSimBar from "./FlowSimBar";
import FlowBottleneckPanel from "./FlowBottleneckPanel";

// Register custom node and edge types — must be stable (defined outside component)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES = { flowNode: FlowNode as any, guideNote: GuideNoteNode as any } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EDGE_TYPES = { flowEdge: FlowEdge as any } as const;

// ─── Inner canvas (needs useReactFlow hook — must be inside ReactFlowProvider)

function FlowCanvasInner() {
  const { screenToFlowPosition, getEdges } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, insertNodeOnEdge, removeNode,
    setSelectedNodeId,
  } = useFlowStore();

  const isRunning = useSimulationStore((s) => s.isRunning);

  // Track the edge being hovered during a drag — for smart insertion
  const [dragOverEdgeId, setDragOverEdgeId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string; x: number; y: number;
  } | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ── Drop handler ──────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";

    // Detect if we're hovering over an edge during drag
    // We read from the RF instance's edge list and check proximity
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const edgeEl = el?.closest("[data-id]");
    if (edgeEl) {
      const eid = edgeEl.getAttribute("data-id");
      if (eid && getEdges().some((eg) => eg.id === eid)) {
        setDragOverEdgeId(eid);
        return;
      }
    }
    setDragOverEdgeId(null);
  }, [getEdges]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const compId = e.dataTransfer.getData("application/archly-component");
    if (!compId) return;

    const comp = getComponent(compId);
    if (!comp) return;

    // Convert screen → flow coordinates
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Center the node on the drop point
    position.x -= 80;
    position.y -= 40;

    if (dragOverEdgeId) {
      // Smart insertion: split the edge
      insertNodeOnEdge(
        dragOverEdgeId,
        comp.id, comp.name, comp.color, comp.strokeColor, comp.icon,
        position
      );
    } else {
      addNode(comp.id, comp.name, comp.color, comp.strokeColor, comp.icon, position);
    }

    setDragOverEdgeId(null);
  }, [screenToFlowPosition, dragOverEdgeId, addNode, insertNodeOnEdge]);

  // ── Node click → set selected in flow store (PropertiesPanel reads it) ──
  const onNodeClick = useCallback((_e: React.MouseEvent, node: { id: string }) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // ── Pane click → deselect ────────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: { id: string }) => {
    e.preventDefault();
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, []);

  // ── Keyboard delete ─────────────────────────────────────────────────────

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const { nodes: ns, edges: es } = useFlowStore.getState();
      // Remove selected nodes
      ns.filter((n) => n.selected).forEach((n) => removeNode(n.id));
      // Remove selected edges (handled by RF via onEdgesChange)
    }
  }, [removeNode]);

  // ── Edge hover highlight (visual feedback for smart insertion) ──────────

  const edgeStyles = useCallback((edgeId: string) => {
    if (edgeId === dragOverEdgeId) {
      return {
        stroke: "var(--pd-brand)",
        strokeWidth: 3,
        filter: "drop-shadow(0 0 4px var(--pd-brand))",
      };
    }
    return {};
  }, [dragOverEdgeId]);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => ({
          ...e,
          style: edgeStyles(e.id),
        }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={{
          type: "flowEdge",
          animated: false,
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={3}
        snapToGrid
        snapGrid={[12, 12]}
        colorMode={isDark ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
        style={{
          background: isDark ? "var(--pd-bg)" : "#f8f8fa",
        }}
      >
        {/* ── Controls ── */}
        <Controls
          position="bottom-left"
          style={{
            background: "var(--pd-surface)",
            border: "1px solid var(--pd-border)",
            borderRadius: "var(--pd-radius)",
            boxShadow: "var(--pd-shadow)",
          }}
        />

        {/* ── Minimap ── */}
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => (n.data as { strokeColor?: string })?.strokeColor ?? "#6b7280"}
          style={{
            background: "var(--pd-surface)",
            border: "1px solid var(--pd-border)",
            borderRadius: "var(--pd-radius)",
          }}
          maskColor={isDark ? "rgba(0,0,0,0.4)" : "rgba(240,240,245,0.7)"}
        />

        {/* ── Grid background ── */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={isDark ? "#2e2e3d" : "#d4d4dc"}
        />
      </ReactFlow>

      {/* ── Empty state hint ── */}
      {nodes.length === 0 && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none", gap: 10,
        }}>
          <div style={{
            fontSize: 36, opacity: 0.3,
          }}>⬡</div>
          <p style={{
            fontSize: 14, fontWeight: 600,
            color: "var(--pd-text-subtle)", textAlign: "center",
          }}>
            Drag components from the left panel
            <br />to start building your architecture
          </p>
          <p style={{ fontSize: 12, color: "var(--pd-text-subtle)" }}>
            Connect nodes by dragging from a handle
            <br />Drop onto an edge to insert between nodes
          </p>
        </div>
      )}

      {/* ── Smart insertion hint ── */}
      {dragOverEdgeId && (
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)",
          background: "var(--pd-brand)",
          color: "#fff", fontSize: 12, fontWeight: 700,
          padding: "5px 14px", borderRadius: "var(--pd-radius-full)",
          boxShadow: "var(--pd-shadow)",
          pointerEvents: "none",
          animation: "fade-in 150ms ease",
          zIndex: 50,
        }}>
          ↓ Drop to insert between nodes
        </div>
      )}

      {/* ── Simulation running badge ── */}
      {isRunning && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          display: "flex", alignItems: "center", gap: 6,
          background: "color-mix(in srgb, var(--pd-brand) 12%, var(--pd-surface))",
          border: "1px solid color-mix(in srgb, var(--pd-brand) 30%, transparent)",
          borderRadius: "var(--pd-radius-full)",
          padding: "5px 12px", fontSize: 12, fontWeight: 700,
          color: "var(--pd-brand)",
          boxShadow: "var(--pd-shadow)",
          pointerEvents: "none",
          zIndex: 50,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--pd-brand)",
            animation: "pulse-ring 1.5s ease-in-out infinite",
          }} />
          Simulating
        </div>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <FlowContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── Bottleneck ranking panel ── */}
      {isRunning && <FlowBottleneckPanel />}
    </div>
  );
}

// ─── Public export — wraps inner in ReactFlowProvider ─────────────────────

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
