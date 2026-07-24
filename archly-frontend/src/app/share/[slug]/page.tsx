import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Shared Design — Archly`,
    description: `View this system design shared via Archly (${slug})`,
  };
}

/**
 * Read-only shared canvas view.
 * Resolves the slug → design elements via shareApi.resolve(),
 * then renders the canvas in read-only mode. Populated in Phase 12.
 */
export default async function SharePage({ params }: Props) {
  const { slug } = await params;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--pd-bg)",
        color: "var(--pd-text-muted)",
        fontFamily: "Assistant, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
      }}
    >
      Loading shared design: {slug}…
    </div>
  );
}
