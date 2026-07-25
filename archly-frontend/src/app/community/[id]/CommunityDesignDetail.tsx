"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDesign, useForkDesign } from "@/hooks/useDesigns";
import { useAuth } from "@/providers/auth-provider";
import type { DesignKind } from "@/types";

interface Props {
  id: string;
}

function kindLabel(kind?: DesignKind | string) {
  return kind === "flow" ? "Flow" : "Canvas";
}

export default function CommunityDesignDetail({ id }: Props) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data: design, isLoading, error } = useDesign(id);
  const forkMutation = useForkDesign();

  const handleOpen = () => {
    router.push(`/canvas?designId=${id}`);
  };

  const handleFork = async () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    try {
      const forked = await forkMutation.mutateAsync(id);
      router.push(`/canvas?designId=${forked.id}`);
    } catch {
      // mutation surfaces via UI busy state; keep page stable
    }
  };

  const kind = design?.kind === "flow" ? "flow" : "canvas";
  const author =
    design?.authorName ??
    design?.authorId ??
    (design?.user_id ? String(design.user_id).slice(0, 8) : "Community");
  const forks = design?.forkCount ?? design?.fork_count ?? 0;
  const stars = design?.starCount ?? design?.star_count ?? 0;
  const views = design?.viewCount ?? design?.view_count ?? 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--pd-bg)",
        color: "var(--pd-text)",
        fontFamily: "Assistant, sans-serif",
        padding: "80px 24px 48px",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <Link
        href="/community"
        style={{
          color: "var(--pd-text-muted)",
          fontSize: 13,
          textDecoration: "none",
          display: "inline-flex",
          marginBottom: 28,
        }}
      >
        ← Community
      </Link>

      {isLoading ? (
        <div style={{ color: "var(--pd-text-subtle)" }}>Loading design…</div>
      ) : error || !design ? (
        <div style={{ color: "var(--pd-text-muted)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Design not found</div>
          <p style={{ fontSize: 14 }}>It may have been unpublished or removed.</p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "var(--pd-radius-full)",
                background:
                  kind === "flow"
                    ? "color-mix(in srgb, #6366f1 14%, transparent)"
                    : "color-mix(in srgb, #10b981 14%, transparent)",
                color: kind === "flow" ? "#6366f1" : "#10b981",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.02,
              }}
            >
              {kindLabel(kind)}
            </span>
            {(design.tags ?? []).slice(0, 4).map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 10px",
                  borderRadius: "var(--pd-radius-full)",
                  background: "var(--pd-bg-muted)",
                  border: "1px solid var(--pd-border)",
                  fontSize: 11,
                  color: "var(--pd-text-muted)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 10,
              lineHeight: 1.25,
            }}
          >
            {design.title}
          </h1>

          {design.description ? (
            <p
              style={{
                color: "var(--pd-text-muted)",
                fontSize: 15,
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              {design.description}
            </p>
          ) : (
            <p
              style={{
                color: "var(--pd-text-subtle)",
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              No description provided.
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              fontSize: 13,
              color: "var(--pd-text-muted)",
              marginBottom: 28,
            }}
          >
            <span>by {author}</span>
            <span>⭐ {stars}</span>
            <span>🍴 {forks}</span>
            <span>👁 {views}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleOpen}
              style={{
                padding: "10px 20px",
                borderRadius: "var(--pd-radius)",
                background: "var(--pd-brand)",
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => void handleFork()}
              disabled={forkMutation.isPending}
              style={{
                padding: "10px 20px",
                borderRadius: "var(--pd-radius)",
                background: "transparent",
                color: "var(--pd-text)",
                border: "1px solid var(--pd-border-strong)",
                fontSize: 13,
                fontWeight: 700,
                cursor: forkMutation.isPending ? "wait" : "pointer",
                opacity: forkMutation.isPending ? 0.7 : 1,
              }}
            >
              {forkMutation.isPending ? "Forking…" : "Fork"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
