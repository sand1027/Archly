/** Schema / ERD types for Archly Schema mode. */

export type SchemaCardinality = "1:1" | "1:N" | "N:M" | "N:1";

export interface SchemaFkRef {
  table: string;
  column: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  pk?: boolean;
  fk?: SchemaFkRef | null;
  unique?: boolean;
  nullable?: boolean;
}

export interface SchemaTableData {
  tableName: string;
  columns: SchemaColumn[];
  /** Allow RF extra fields */
  [key: string]: unknown;
}

export interface SchemaRelationData {
  cardinality: SchemaCardinality;
  label?: string;
  /** FK column on the many / child side when known */
  fkColumn?: string;
  [key: string]: unknown;
}
