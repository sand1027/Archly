import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Canvas",
};

/**
 * Canvas layout: full-screen, overflow hidden.
 * No navbar — the canvas has its own toolbar chrome.
 */
export default function CanvasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="canvas-page">
      {children}
    </div>
  );
}
