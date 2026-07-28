/**
 * Detect database engine from a connection URL (mirrors backend ParseURL).
 */

export type DbDriver = "postgres" | "mysql" | "sqlite" | "mongodb";

export interface DbUrlInfo {
  driver: DbDriver | null;
  schemaFromUrl: string;
  databaseFromUrl: string;
  showSchemaOverride: boolean;
  supportsDatabasePicker: boolean;
  placeholder: string;
  label: string;
}

export function detectDbFromUrl(raw: string): DbUrlInfo {
  const empty: DbUrlInfo = {
    driver: null,
    schemaFromUrl: "",
    databaseFromUrl: "",
    showSchemaOverride: false,
    supportsDatabasePicker: false,
    placeholder: "postgresql://… | mysql://… | mongodb://… | sqlite://…",
    label: "Database URL",
  };

  const trimmed = raw.trim();
  if (!trimmed) return empty;

  if (!trimmed.includes("://")) {
    const lower = trimmed.toLowerCase();
    if (lower.endsWith(".db") || lower.endsWith(".sqlite") || lower.endsWith(".sqlite3")) {
      return {
        driver: "sqlite",
        schemaFromUrl: "main",
        databaseFromUrl: "",
        showSchemaOverride: false,
        supportsDatabasePicker: false,
        placeholder: trimmed,
        label: "SQLite file",
      };
    }
    return empty;
  }

  try {
    const u = new URL(trimmed);
    const scheme = u.protocol.replace(":", "").toLowerCase();

    if (scheme === "postgres" || scheme === "postgresql") {
      const db = u.pathname.replace(/^\//, "") || "";
      return {
        driver: "postgres",
        schemaFromUrl: "public",
        databaseFromUrl: db,
        showSchemaOverride: true,
        supportsDatabasePicker: true,
        placeholder: "postgresql://user:pass@host:5432/",
        label: "PostgreSQL",
      };
    }

    if (scheme === "mysql" || scheme === "mariadb") {
      const db = u.pathname.replace(/^\//, "") || u.searchParams.get("database") || "";
      return {
        driver: "mysql",
        schemaFromUrl: db,
        databaseFromUrl: db,
        showSchemaOverride: false,
        supportsDatabasePicker: true,
        placeholder: "mysql://user:pass@host:3306/",
        label: "MySQL",
      };
    }

    if (scheme === "mongodb" || scheme === "mongodb+srv") {
      const db = u.pathname.replace(/^\//, "") || u.searchParams.get("authSource") || "";
      return {
        driver: "mongodb",
        schemaFromUrl: db,
        databaseFromUrl: db,
        showSchemaOverride: false,
        supportsDatabasePicker: true,
        placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/",
        label: "MongoDB",
      };
    }

    if (scheme === "sqlite" || scheme === "file") {
      return {
        driver: "sqlite",
        schemaFromUrl: "main",
        databaseFromUrl: "",
        showSchemaOverride: false,
        supportsDatabasePicker: false,
        placeholder: "sqlite:///path/to/database.db",
        label: "SQLite",
      };
    }
  } catch {
    return empty;
  }

  return empty;
}
