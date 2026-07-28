/**
 * All typed API calls to the Go backend.
 * Each function maps to one route from DESIGN.md section 6.
 */

import { api } from "./client";
import type {
  AuthUser,
  CommunityDesign,
  DesignKind,
  SavedDesign,
  ShareLink,
} from "@/types";

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;  // backend expects snake_case
}

export const authApi = {
  register: (body: RegisterRequest) =>
    api.post<AuthResponse>("/auth/register", body),

  login: (body: LoginRequest) =>
    api.post<AuthResponse>("/auth/login", body),

  refresh: () =>
    api.post<AuthResponse>("/auth/refresh"),

  me: () =>
    api.get<AuthUser>("/auth/me"),
};

// ─── Designs (community) ───────────────────────────────────────────────────

export interface DesignsListResponse {
  designs: CommunityDesign[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublishDesignRequest {
  title: string;
  description: string;
  tags: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: Record<string, any>;
}

export interface MyDesignsResponse {
  designs: SavedDesign[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SaveDesignRequest {
  title: string;
  description?: string;
  tags?: string[];
  kind: DesignKind;
  // Canvas: Excalidraw elements. Flow: { nodes, edges }.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app_state: Record<string, any>;
}

export const designsApi = {
  list: (params?: { page?: number; pageSize?: number; tag?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.tag)      qs.set("tag", params.tag);
    if (params?.q)        qs.set("q", params.q);
    const query = qs.toString();
    return api.get<DesignsListResponse>(`/designs${query ? `?${query}` : ""}`);
  },

  get: (id: string) =>
    api.get<CommunityDesign>(`/designs/${id}`),

  // My saved sessions (private history)
  mine: (params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return api.get<MyDesignsResponse>(`/designs/mine${query ? `?${query}` : ""}`);
  },

  getMine: (id: string) =>
    api.get<SavedDesign>(`/designs/${id}`),

  save: (body: SaveDesignRequest) =>
    api.post<SavedDesign>("/designs", body),

  saveUpdate: (id: string, body: SaveDesignRequest) =>
    api.patch<SavedDesign>(`/designs/${id}`, body),

  publish: (body: PublishDesignRequest) =>
    api.post<CommunityDesign>("/designs", body),

  update: (id: string, body: Partial<PublishDesignRequest>) =>
    api.patch<CommunityDesign>(`/designs/${id}`, body),

  delete: (id: string) =>
    api.delete<void>(`/designs/${id}`),

  fork: (id: string) =>
    api.post<CommunityDesign>(`/designs/${id}/fork`),

  star: (id: string) =>
    api.post<{ starred: boolean }>(`/designs/${id}/star`),
};

// ─── Share links ───────────────────────────────────────────────────────────

export interface CreateShareRequest {
  /** Existing saved design to attach the share link to */
  designId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState?: Record<string, any>;
  ttlHours?: number;
}

export const shareApi = {
  // Backend expects snake_case keys (design_id, app_state, ttl_hours)
  create: (body: CreateShareRequest) =>
    api.post<ShareLink>("/share", {
      design_id: body.designId,
      elements: body.elements,
      app_state: body.appState,
      ttl_hours: body.ttlHours,
    }),

  resolve: (slug: string) =>
    api.get<ShareLink & { elements: unknown[]; appState: unknown }>(
      `/share/${slug}`
    ),
};

// ─── AI ────────────────────────────────────────────────────────────────────

export interface DiagramToCodeRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[];
  format?: "terraform" | "docker-compose" | "kubernetes";
}

export interface DiagramToCodeResponse {
  code: string;
  format: string;
}

export const aiApi = {
  // SSE streaming — use apiStream() from client.ts, not this
  textToDiagramStreamPath: "/v1/ai/text-to-diagram/chat-streaming",
  canvasChatPath: "/v1/ai/canvas-chat",

  diagramToCode: (body: DiagramToCodeRequest) =>
    api.post<DiagramToCodeResponse>("/v1/ai/diagram-to-code/generate", body),
};

// ─── Health ────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api.get<{ status: string; version: string }>("/health"),
};

// ─── Schema (DB introspection) ─────────────────────────────────────────────

export interface SchemaIntrospectRequest {
  url: string;
  database?: string;
  schema?: string;
  tables?: string[];
}

export interface SchemaListTablesResponse {
  driver: string;
  schema: string;
  tables: string[];
}

export interface SchemaListDatabasesResponse {
  driver: string;
  databases: string[];
  default?: string;
}

export interface SchemaGraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    tableName: string;
    columns: {
      name: string;
      type: string;
      pk?: boolean;
      unique?: boolean;
      nullable?: boolean;
      fk?: { table: string; column: string } | null;
    }[];
  };
}

export interface SchemaGraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  label?: string;
  data: {
    cardinality: string;
    label?: string;
    fkColumn?: string;
  };
}

export interface SchemaIntrospectResponse {
  driver: string;
  schema: string;
  database: string;
  tables: number;
  graph: {
    nodes: SchemaGraphNode[];
    edges: SchemaGraphEdge[];
  };
  warnings?: string[];
}

export const schemaApi = {
  listDatabases: (body: { url: string }) =>
    api.post<SchemaListDatabasesResponse>("/v1/schema/databases", body),
  listTables: (body: { url: string; database?: string; schema?: string }) =>
    api.post<SchemaListTablesResponse>("/v1/schema/tables", body),
  introspect: (body: SchemaIntrospectRequest) =>
    api.post<SchemaIntrospectResponse>("/v1/schema/introspect", body),
};
