"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useMyDesigns, useDeleteDesign, useUpdateDesign, useSaveDesign } from "@/hooks/useDesigns";
import { useAuth } from "@/providers/auth-provider";
import { shareApi } from "@/lib/api/endpoints";
import { summarizeVersionDiff } from "@/lib/ai/version-diff";
import { snapshotActive } from "@/lib/session/sessions";
import type { DesignKind, SavedDesign } from "@/types";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSession: (design: SavedDesign) => void;
  onDuplicated?: (design: SavedDesign) => void;
  currentSessionId: string | null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPanel({
  isOpen,
  onClose,
  onOpenSession,
  onDuplicated,
  currentSessionId,
}: HistoryPanelProps) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useMyDesigns(
    { pageSize: 50 },
    isOpen && isAuthenticated
  );
  const deleteMutation = useDeleteDesign();
  const updateMutation = useUpdateDesign();
  const saveMutation = useSaveDesign();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | DesignKind>("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<{ id: string; text: string } | null>(null);

  const designs = useMemo(() => {
    const list = data?.designs ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((d) => {
      if (kindFilter !== "all" && d.kind !== kindFilter) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data?.designs, query, kindFilter]);

  if (!isOpen) return null;

  const toast = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2000);
  };

  const commitRename = async (d: SavedDesign) => {
    const title = renameValue.trim();
    if (!title || title === d.title) {
      setRenamingId(null);
      return;
    }
    setBusyId(d.id);
    try {
      await updateMutation.mutateAsync({
        id: d.id,
        body: {
          title,
          description: d.description ?? "",
          tags: d.tags ?? [],
          kind: d.kind,
          elements: d.elements,
          app_state: d.app_state ?? {},
        },
      });
      toast("Renamed ✓");
    } catch {
      toast("Rename failed");
    } finally {
      setBusyId(null);
      setRenamingId(null);
    }
  };

  const duplicate = async (d: SavedDesign) => {
    setBusyId(d.id);
    try {
      const saved = await saveMutation.mutateAsync({
        title: `${d.title} (copy)`,
        description: d.description ?? "",
        tags: d.tags ?? [],
        kind: d.kind,
        elements: d.elements,
        app_state: d.app_state ?? {},
      });
      toast("Duplicated ✓");
      onDuplicated?.(saved);
    } catch {
      toast("Duplicate failed");
    } finally {
      setBusyId(null);
    }
  };

  const shareSession = async (d: SavedDesign) => {
    setBusyId(d.id);
    try {
      const result = await shareApi.create({
        designId: d.id,
        elements: Array.isArray(d.elements) ? d.elements : undefined,
        appState: d.app_state,
        ttlHours: 72,
      });
      const url = `${window.location.origin}/share/${result.slug}`;
      await navigator.clipboard.writeText(url);
      toast("Share link copied ✓");
    } catch {
      toast("Share failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Session history"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(360px, 100%)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        background: "var(--pd-surface-raised)",
        borderLeft: "1px solid var(--pd-border)",
        boxShadow: "var(--pd-shadow)",
        animation: "fade-in 160ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          borderBottom: "1px solid var(--pd-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pd-text)" }}>
            History
          </div>
          <div style={{ fontSize: 11, color: "var(--pd-text-muted)" }}>
            Your saved canvas &amp; flow sessions
          </div>
        </div>
        <button type="button" onClick={onClose} title="Close" style={iconBtn}>
          ✕
        </button>
      </div>

      {isAuthenticated && (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--pd-border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "var(--pd-radius)",
              border: "1px solid var(--pd-border)",
              background: "var(--pd-bg-subtle)",
              color: "var(--pd-text)",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "canvas", "flow"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  borderRadius: "var(--pd-radius)",
                  border: "1px solid var(--pd-border)",
                  background: kindFilter === k ? "var(--pd-brand)" : "transparent",
                  color: kindFilter === k ? "#fff" : "var(--pd-text-muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {k}
              </button>
            ))}
          </div>
          {flash && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pd-brand)" }}>
              {flash}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {!isAuthenticated ? (
          <EmptyState
            title="Sign in to view history"
            body="Saved sessions are tied to your account. Log in to save and reopen your work."
          />
        ) : isLoading ? (
          <EmptyState title="Loading…" body="Fetching your saved sessions." />
        ) : error ? (
          <EmptyState
            title="Couldn’t load history"
            body="Something went wrong. Is the backend running?"
          />
        ) : designs.length === 0 ? (
          <EmptyState
            title={query || kindFilter !== "all" ? "No matches" : "No saved sessions yet"}
            body={
              query || kindFilter !== "all"
                ? "Try a different search or filter."
                : "Use Save in the toolbar to store the current canvas or flow. It’ll show up here."
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {designs.map((d) => {
              const active = d.id === currentSessionId;
              const confirming = pendingDelete === d.id;
              const renaming = renamingId === d.id;
              const busy = busyId === d.id;
              return (
                <div
                  key={d.id}
                  style={{
                    border: `1px solid ${active ? "var(--pd-brand)" : "var(--pd-border)"}`,
                    borderRadius: 10,
                    background: active
                      ? "var(--pd-brand-subtle)"
                      : "var(--pd-bg-subtle)",
                    padding: "10px 11px",
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: "var(--pd-radius-full)",
                        background:
                          d.kind === "flow"
                            ? "color-mix(in srgb, #6366f1 16%, transparent)"
                            : "color-mix(in srgb, #10b981 16%, transparent)",
                        color: d.kind === "flow" ? "#6366f1" : "#10b981",
                        flexShrink: 0,
                      }}
                    >
                      {d.kind === "flow" ? "Flow" : "Canvas"}
                    </span>
                    {renaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitRename(d);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => void commitRename(d)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 6px",
                          borderRadius: 6,
                          border: "1px solid var(--pd-brand)",
                          outline: "none",
                          background: "var(--pd-surface)",
                          color: "var(--pd-text)",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--pd-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          cursor: "text",
                        }}
                        title="Double-click to rename"
                        onDoubleClick={() => {
                          setRenamingId(d.id);
                          setRenameValue(d.title);
                        }}
                      >
                        {d.title}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--pd-text-muted)",
                      margin: "6px 0 9px",
                    }}
                  >
                    Updated {relativeTime(d.updated_at)}
                  </div>

                  {confirming ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteMutation.mutateAsync(d.id);
                          setPendingDelete(null);
                        }}
                        style={{
                          ...smallBtn,
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                        }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        style={smallBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => onOpenSession(d)}
                        style={{ ...smallBtn, ...primarySmall, flex: "1 1 40%" }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(d.id);
                          setRenameValue(d.title);
                        }}
                        style={{ ...smallBtn, flex: "1 1 25%" }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => void duplicate(d)}
                        style={{ ...smallBtn, flex: "1 1 25%" }}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareSession(d)}
                        style={{ ...smallBtn, flex: "1 1 40%" }}
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = snapshotActive(d.kind).elements;
                          setDiffResult({
                            id: d.id,
                            text: summarizeVersionDiff(current, d.elements),
                          });
                        }}
                        style={{ ...smallBtn, flex: "1 1 40%" }}
                      >
                        Diff vs current
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(d.id)}
                        style={{ ...smallBtn, flex: "1 1 40%" }}
                        title="Delete session"
                      >
                        Delete
                      </button>
                      {diffResult?.id === d.id && (
                        <div
                          style={{
                            flex: "1 1 100%",
                            padding: "7px 8px",
                            borderRadius: 7,
                            background: "var(--pd-bg-muted)",
                            color: "var(--pd-text-muted)",
                            fontSize: 10.5,
                            lineHeight: 1.4,
                          }}
                        >
                          {diffResult.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 18px",
        color: "var(--pd-text-muted)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pd-text)" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>{body}</div>
    </div>
  );
}

const iconBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  cursor: "pointer",
};

const smallBtn: CSSProperties = {
  flex: 1,
  padding: "6px 0",
  borderRadius: "var(--pd-radius)",
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  color: "var(--pd-text)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const primarySmall: CSSProperties = {
  background: "var(--pd-brand)",
  color: "#fff",
  border: "none",
  fontWeight: 700,
};
