import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Design ${id} — Archly Community`,
  };
}

/**
 * Design detail page — shows design info + fork button.
 * Canvas preview + full design content populated in Phase 12.
 */
export default async function CommunityDesignPage({ params }: Props) {
  const { id } = await params;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--pd-bg)",
        color: "var(--pd-text)",
        fontFamily: "Assistant, sans-serif",
        padding: "80px 24px 48px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <p style={{ color: "var(--pd-text-muted)", marginBottom: 24 }}>
        Design ID: {id}
      </p>
      <div style={{ color: "var(--pd-text-subtle)" }}>Loading design…</div>
    </main>
  );
}
