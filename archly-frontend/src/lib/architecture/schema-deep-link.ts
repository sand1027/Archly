/**
 * Detect architecture DB / datastore nodes for Schema deep-linking.
 */

export const SCHEMA_LINKABLE_COMPONENT_IDS = new Set([
  "sql_db",
  "nosql_db",
  "mysql",
  "dynamodb",
  "cockroachdb",
  "cassandra",
  "scylladb",
  "timescaledb",
  "vitess",
  "clickhouse",
  "influxdb",
  "neo4j",
  "vector_db",
  "pinecone",
  "weaviate",
  "qdrant",
  "milvus",
  "data_warehouse",
]);

export function isSchemaLinkableComponent(componentId: string | undefined | null): boolean {
  if (!componentId) return false;
  return SCHEMA_LINKABLE_COMPONENT_IDS.has(componentId);
}

/** Prompt to design schema focused on one datastore node. */
export function schemaForDatabaseNodePrompt(
  label: string,
  componentId: string,
  siblingLabels: string[]
): string {
  const siblings =
    siblingLabels.length > 0
      ? `\nNearby architecture components: ${siblingLabels.slice(0, 20).join(", ")}.`
      : "";
  return `Design the production database schema for: the datastore "${label}" (${componentId}) in a larger system.${siblings}

Invent a realistic multi-table ERD for what this database would hold (auth, domain entities, join tables, audit). Aim for 8–20 tables with PKs/FKs. Output ONLY Mermaid starting with "erDiagram". No flowchart. No other text.`;
}
