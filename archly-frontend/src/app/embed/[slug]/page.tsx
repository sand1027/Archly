import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Archly Embed",
};

/**
 * Minimal read-only embed view — no toolbar, no chrome.
 * Used for iframing a design into external sites.
 */
export default async function EmbedPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        color: "#71717a",
        fontFamily: "Assistant, sans-serif",
      }}
    >
      Loading embed: {slug}…
    </div>
  );
}
