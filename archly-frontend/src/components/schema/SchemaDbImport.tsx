"use client";

import { useEffect, useMemo, useState } from "react";
import { schemaApi } from "@/lib/api/endpoints";
import { detectDbFromUrl } from "@/lib/schema/detect-db-url";
import {
  annotateNodesWithDiff,
  diffSchemaGraphs,
  type SchemaDiffResult,
} from "@/lib/schema/schema-diff";
import { useSchemaStore } from "@/store/schema.store";
import { withFkEdges } from "@/lib/schema/schema-edges";
import { toast } from "@/store/toast.store";
import type { CSSProperties } from "react";

interface Props {
  variant?: "compact" | "panel";
  onSuccess?: () => void;
}

export default function SchemaDbImport({ variant = "compact", onSuccess }: Props) {
  const [url, setUrl] = useState("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [schemaOverride, setSchemaOverride] = useState("");
  const [listing, setListing] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(variant === "panel");
  const [lastDiff, setLastDiff] = useState<SchemaDiffResult | null>(null);

  const setGraph = useSchemaStore((s) => s.setGraph);
  const setImportContext = useSchemaStore((s) => s.setImportContext);
  const baselineNodes = useSchemaStore((s) => s.baselineNodes);

  const dbInfo = useMemo(() => detectDbFromUrl(url), [url]);

  useEffect(() => {
    setDatabases([]);
    setSelectedDatabase("");
    setAvailableTables([]);
    setSelectedTables(new Set());
    setLastDiff(null);
  }, [url]);

  useEffect(() => {
    setAvailableTables([]);
    setSelectedTables(new Set());
  }, [selectedDatabase]);

  const connectAndList = async () => {
    const trimmed = url.trim();
    if (!trimmed || !dbInfo.driver) {
      toast("Paste a valid database URL", "error");
      return;
    }

    setListing(true);
    try {
      const res = await schemaApi.listDatabases({ url: trimmed });
      setDatabases(res.databases);
      const pick =
        res.default && res.databases.includes(res.default)
          ? res.default
          : (res.databases[0] ?? "");
      setSelectedDatabase(pick);
      toast(`Found ${res.databases.length} database(s)`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not list databases", "error");
      setDatabases([]);
    } finally {
      setListing(false);
    }
  };

  const loadTables = async () => {
    const trimmed = url.trim();
    if (!trimmed || !dbInfo.driver) return;

    setLoadingTables(true);
    try {
      const res = await schemaApi.listTables({
        url: trimmed,
        ...(selectedDatabase ? { database: selectedDatabase } : {}),
        ...(schemaOverride.trim() ? { schema: schemaOverride.trim() } : {}),
      });
      setAvailableTables(res.tables);
      setSelectedTables(new Set(res.tables));
      toast(`Found ${res.tables.length} table(s)/collection(s)`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not list tables", "error");
      setAvailableTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const toggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const importDb = async () => {
    const trimmed = url.trim();
    if (!trimmed || !dbInfo.driver) {
      toast("Paste a database URL", "error");
      return;
    }

    const needsPicker = dbInfo.supportsDatabasePicker;
    const database = needsPicker ? selectedDatabase : undefined;
    if (needsPicker && !database) {
      toast("Connect and select a database first", "error");
      return;
    }

    const tables =
      availableTables.length > 0 && selectedTables.size < availableTables.length
        ? [...selectedTables]
        : undefined;

    setLoading(true);
    try {
      const res = await schemaApi.introspect({
        url: trimmed,
        ...(database ? { database } : {}),
        ...(schemaOverride.trim() ? { schema: schemaOverride.trim() } : {}),
        ...(tables?.length ? { tables } : {}),
      });

      let nodes = res.graph.nodes;
      const edges = withFkEdges(nodes, res.graph.edges);

      if (baselineNodes.length > 0) {
        const diff = diffSchemaGraphs(baselineNodes, nodes);
        setLastDiff(diff);
        nodes = annotateNodesWithDiff(nodes, diff);
        if (diff.added + diff.removed + diff.changed > 0) {
          toast(
            `Drift: +${diff.added} added, -${diff.removed} removed, ~${diff.changed} changed`,
            "info"
          );
        }
      }

      setGraph(nodes, edges, { merge: false });
      setImportContext(
        { driver: res.driver, database: res.database, schema: res.schema },
        {
          url: trimmed,
          database,
          schema: schemaOverride.trim() || res.schema,
          driver: res.driver,
        },
        nodes,
        edges
      );

      toast(
        `Imported ${res.tables} tables from ${res.driver}${res.schema ? ` (${res.schema})` : ""}`,
        "success"
      );
      if (res.warnings?.length) {
        toast(`${res.warnings.length} warning(s) during import`, "info");
      }
      onSuccess?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const canImport =
    dbInfo.driver &&
    (!dbInfo.supportsDatabasePicker || (databases.length > 0 && selectedDatabase));

  if (variant === "panel" && !expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} style={panelToggleStyle}>
        Import from database URL
      </button>
    );
  }

  const wrapStyle: CSSProperties =
    variant === "panel"
      ? { padding: "10px 12px", borderBottom: "1px solid var(--pd-border)", background: "var(--pd-surface)" }
      : {
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--pd-border)",
          background: "var(--pd-surface)",
          boxShadow: "var(--pd-shadow-sm)",
        };

  return (
    <div style={wrapStyle}>
      {variant === "panel" && (
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pd-text-muted)", marginBottom: 8 }}>
          Live database import
        </div>
      )}
      {variant === "compact" && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pd-text)", textAlign: "center" }}>
          Or import an existing database
        </div>
      )}

      {dbInfo.driver && (
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pd-brand)", textTransform: "capitalize" }}>
          Detected: {dbInfo.label}
        </div>
      )}

      <input
        type="password"
        autoComplete="off"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={dbInfo.placeholder}
        className="pd-input"
        style={{ width: "100%", fontSize: 12.5 }}
      />

      {dbInfo.supportsDatabasePicker && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={connectAndList} disabled={listing || !url.trim()} style={secondaryBtnStyle}>
            {listing ? "Connecting…" : databases.length ? "Refresh DBs" : "Connect"}
          </button>
          {databases.length > 0 && (
            <select
              value={selectedDatabase}
              onChange={(e) => setSelectedDatabase(e.target.value)}
              className="pd-input"
              style={{ flex: 1, minWidth: 120, fontSize: 12 }}
            >
              {databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          )}
          {selectedDatabase && (
            <button type="button" onClick={loadTables} disabled={loadingTables} style={secondaryBtnStyle}>
              {loadingTables ? "Loading…" : availableTables.length ? "Refresh tables" : "Load tables"}
            </button>
          )}
        </div>
      )}

      {availableTables.length > 0 && (
        <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--pd-border)", borderRadius: 8, padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pd-text-subtle)" }}>
              Pick tables ({selectedTables.size}/{availableTables.length})
            </span>
            <button
              type="button"
              style={linkBtnStyle}
              onClick={() =>
                setSelectedTables(
                  selectedTables.size === availableTables.length
                    ? new Set()
                    : new Set(availableTables)
                )
              }
            >
              {selectedTables.size === availableTables.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {availableTables.map((t) => (
              <label key={t} style={{ fontSize: 11.5, display: "flex", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedTables.has(t)} onChange={() => toggleTable(t)} />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}

      {dbInfo.showSchemaOverride && (
        <input
          value={schemaOverride}
          onChange={(e) => setSchemaOverride(e.target.value)}
          placeholder="Postgres schema (optional — default: public)"
          className="pd-input"
          style={{ width: "100%", fontSize: 12 }}
        />
      )}

      {lastDiff && (lastDiff.added > 0 || lastDiff.removed > 0 || lastDiff.changed > 0) && (
        <div style={{ fontSize: 11, color: "var(--pd-text-muted)", lineHeight: 1.4 }}>
          Drift vs last import:{" "}
          <span style={{ color: "#16a34a" }}>+{lastDiff.added}</span>{" "}
          <span style={{ color: "#dc2626" }}>-{lastDiff.removed}</span>{" "}
          <span style={{ color: "#d97706" }}>~{lastDiff.changed}</span>
        </div>
      )}

      <button
        type="button"
        onClick={importDb}
        disabled={loading || listing || !canImport}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          background: loading || !canImport ? "var(--pd-bg-muted)" : "var(--pd-accent, var(--pd-brand))",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          cursor: loading ? "wait" : "pointer",
          width: "100%",
        }}
      >
        {loading ? "Importing…" : baselineNodes.length ? "Re-import & diff" : "Import"}
      </button>

      <p style={{ margin: 0, fontSize: 11, color: "var(--pd-text-subtle)", lineHeight: 1.4 }}>
        Connect → pick database → load tables → import selected. Re-import highlights schema drift.
      </p>
    </div>
  );
}

const panelToggleStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  marginBottom: 8,
  borderRadius: 8,
  border: "1px dashed var(--pd-border)",
  background: "transparent",
  color: "var(--pd-text-muted)",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
};

const secondaryBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--pd-border)",
  background: "var(--pd-surface)",
  color: "var(--pd-text)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const linkBtnStyle: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--pd-brand)",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};
