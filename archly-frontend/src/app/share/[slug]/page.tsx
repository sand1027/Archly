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
      className="share-page"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--pd-bg)",
        color: "var(--pd-text-muted)",
        fontFamily: "Assistant, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 5vw, 48px)",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(8px, 2vw, 14px)",
        }}
      >
        <div
          style={{
            fontSize: "clamp(28px, 8vw, 40px)",
            lineHeight: 1,
            opacity: 0.85,
          }}
          aria-hidden
        >
          ↗
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(18px, 4.5vw, 22px)",
            fontWeight: 800,
            color: "var(--pd-text)",
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          Shared design
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(13px, 3.5vw, 15px)",
            lineHeight: 1.55,
            color: "var(--pd-text-muted)",
            maxWidth: "36ch",
          }}
        >
          Loading shared design…
        </p>
        <code
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "6px 12px",
            borderRadius: "var(--pd-radius)",
            border: "1px solid var(--pd-border)",
            background: "var(--pd-bg-muted)",
            fontSize: "clamp(11px, 3vw, 13px)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "var(--pd-text)",
            wordBreak: "break-all",
            maxWidth: "100%",
          }}
        >
          {slug}
        </code>
      </div>
    </div>
  );
}
