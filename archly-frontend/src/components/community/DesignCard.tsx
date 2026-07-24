"use client";

import Link from "next/link";
import type { CommunityDesign } from "@/types";

interface DesignCardProps {
  design: CommunityDesign;
  onFork?: (id: string) => void;
  onStar?: (id: string) => void;
}

export default function DesignCard({ design, onFork, onStar }: DesignCardProps) {
  return (
    <div
      style={{
        background: "var(--pd-surface)",
        border: "1px solid var(--pd-border)",
        borderRadius: "var(--pd-radius-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--pd-shadow)";
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--pd-border-strong)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--pd-border)";
      }}
    >
      {/* Preview area */}
      <Link
        href={`/community/${design.id}`}
        style={{
          height: 140,
          background: "var(--pd-bg-subtle)",
          borderBottom: "1px solid var(--pd-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          color: "var(--pd-text-subtle)",
          fontSize: 32,
        }}
      >
        🖼
      </Link>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1 }}>
        <Link
          href={`/community/${design.id}`}
          style={{
            display: "block",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--pd-text)",
            textDecoration: "none",
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {design.title}
        </Link>

        {design.description && (
          <p
            style={{
              fontSize: 12,
              color: "var(--pd-text-muted)",
              marginBottom: 8,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {design.description}
          </p>
        )}

        {/* Tags */}
        {design.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {design.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "2px 7px",
                  borderRadius: "var(--pd-radius-full)",
                  background: "var(--pd-bg-muted)",
                  border: "1px solid var(--pd-border)",
                  fontSize: 10,
                  color: "var(--pd-text-muted)",
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderTop: "1px solid var(--pd-border)",
          gap: 8,
        }}
      >
        {/* Author */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--pd-brand)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {design.authorName[0]?.toUpperCase()}
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--pd-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {design.authorName}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <StatButton
            icon="⭐"
            count={design.starCount}
            onClick={() => onStar?.(design.id)}
            title="Star"
          />
          <StatButton
            icon="🍴"
            count={design.forkCount}
            onClick={() => onFork?.(design.id)}
            title="Fork onto canvas"
          />
        </div>
      </div>
    </div>
  );
}

function StatButton({
  icon,
  count,
  onClick,
  title,
}: {
  icon: string;
  count: number;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 6px",
        borderRadius: "var(--pd-radius-sm)",
        border: "1px solid var(--pd-border)",
        background: "transparent",
        color: "var(--pd-text-muted)",
        fontSize: 11,
        cursor: onClick ? "pointer" : "default",
        fontWeight: 600,
      }}
    >
      <span>{icon}</span>
      <span>{count}</span>
    </button>
  );
}
