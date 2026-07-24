"use client";

/**
 * PacketAnimator — SVG overlay rendered on top of the Excalidraw canvas.
 * Reads packets from the simulation store and positions animated dots
 * along the paths between nodes using getPacketPosition().
 *
 * This component uses useAnimationFrame to re-render every frame while
 * the simulation is running. It must be absolutely positioned over the canvas.
 */

import { useRef, useEffect, useCallback } from "react";
import { useSimulationStore } from "@/store/simulation.store";
import { useCanvasStore } from "@/store/canvas.store";
import { getPacketPosition } from "@/lib/simulation/engine";

interface PacketAnimatorProps {
  /** Canvas scroll/zoom transform so packets stay aligned with nodes */
  scrollX?: number;
  scrollY?: number;
  zoom?: number;
}

export default function PacketAnimator({
  scrollX = 0,
  scrollY = 0,
  zoom = 1,
}: PacketAnimatorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  const { elements } = useCanvasStore();

  const draw = useCallback(() => {
    const { packets, isRunning } = useSimulationStore.getState();
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous dots
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (!isRunning || packets.length === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    for (const packet of packets) {
      const pos = getPacketPosition(packet, elements);
      if (!pos) continue;

      // Apply canvas transform
      const screenX = (pos.x + scrollX) * zoom;
      const screenY = (pos.y + scrollY) * zoom;

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", String(screenX));
      circle.setAttribute("cy", String(screenY));
      circle.setAttribute("r", "5");
      circle.setAttribute(
        "fill",
        packet.isError ? "var(--pd-sim-error)" : "var(--pd-sim-packet)"
      );
      circle.setAttribute("opacity", "0.9");
      circle.setAttribute("class", "packet-dot");
      svg.appendChild(circle);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [elements, scrollX, scrollY, zoom]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "var(--pd-z-canvas-overlay)",
      }}
    />
  );
}
