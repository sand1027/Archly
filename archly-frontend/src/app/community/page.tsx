"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDesigns, useForkDesign, useStarDesign } from "@/hooks/useDesigns";
import DesignCard from "@/components/community/DesignCard";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";

const TAGS = [
  "All",
  "Microservices",
  "Real-time",
  "ML/AI",
  "Streaming",
  "Fintech",
  "Databases",
  "CDN",
  "Event-driven",
];

export default function CommunityPage() {
  const [activeTag, setActiveTag] = useState("All");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const trimmedSearch = search.trim();

  const { data, isLoading, error } = useDesigns({
    tag: activeTag === "All" ? undefined : activeTag.toLowerCase(),
    pageSize: 24,
    q: trimmedSearch || undefined,
  });

  const forkMutation = useForkDesign();
  const starMutation = useStarDesign();

  const designs = useMemo(() => {
    const list = data?.designs ?? [];
    if (!trimmedSearch) return list;
    const q = trimmedSearch.toLowerCase();
    return list.filter((d) => d.title.toLowerCase().includes(q));
  }, [data?.designs, trimmedSearch]);

  const handleFork = async (id: string) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const forked = await forkMutation.mutateAsync(id);
    router.push(`/canvas?designId=${forked.id}`);
  };

  const handleStar = (id: string) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    starMutation.mutate(id);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--pd-bg)",
        color: "var(--pd-text)",
        fontFamily: "Assistant, sans-serif",
      }}
    >
      {/* Nav */}
      <div
        style={{
          borderBottom: "1px solid var(--pd-border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 52,
        }}
      >
        <Link
          href="/canvas"
          style={{
            color: "var(--pd-text-muted)",
            fontSize: 13,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Canvas
        </Link>
        <span style={{ color: "var(--pd-border)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--pd-text)" }}>
          Community Designs
        </span>
        <div style={{ flex: 1 }} />
        {isAuthenticated && (
          <Link
            href="/canvas"
            style={{
              padding: "6px 14px",
              borderRadius: "var(--pd-radius)",
              background: "var(--pd-brand)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            + Publish Design
          </Link>
        )}
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "var(--pd-text)" }}
          >
            Community System Designs
          </h1>
          <p style={{ color: "var(--pd-text-muted)", fontSize: 15 }}>
            Browse, fork, and stress-test architectures from the community.
            Fork any design to load it on the canvas and run simulations.
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designs by title…"
            aria-label="Search designs by title"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "10px 14px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "var(--pd-surface)",
              color: "var(--pd-text)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {/* Tag filter */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              style={{
                padding: "5px 14px",
                borderRadius: "var(--pd-radius-full)",
                border: `1px solid ${
                  activeTag === tag ? "var(--pd-brand)" : "var(--pd-border)"
                }`,
                background:
                  activeTag === tag ? "var(--pd-brand-subtle)" : "transparent",
                color:
                  activeTag === tag ? "var(--pd-brand)" : "var(--pd-text-muted)",
                fontSize: 13,
                fontWeight: activeTag === tag ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              color: "var(--pd-text-muted)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div>Failed to load designs. Is the backend running?</div>
          </div>
        ) : !designs.length ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "var(--pd-text-muted)",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {trimmedSearch
                ? "No designs match your search"
                : "No published designs yet. Be the first to publish!"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>
              {trimmedSearch
                ? "Try a different title or clear the search."
                : "Draw your architecture on the canvas and click Publish."}
            </div>
            {!trimmedSearch && (
              <Link
                href="/canvas"
                style={{
                  padding: "8px 20px",
                  borderRadius: "var(--pd-radius)",
                  background: "var(--pd-brand)",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Open Canvas →
              </Link>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {designs.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                onFork={handleFork}
                onStar={handleStar}
              />
            ))}
          </div>
        )}

        {/* Pagination hint */}
        {data && data.total > designs.length && !trimmedSearch && (
          <div
            style={{
              textAlign: "center",
              marginTop: 32,
              color: "var(--pd-text-subtle)",
              fontSize: 13,
            }}
          >
            Showing {designs.length} of {data.total} designs
          </div>
        )}
      </div>
    </main>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        height: 280,
        borderRadius: "var(--pd-radius-lg)",
        background: "var(--pd-bg-muted)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}
