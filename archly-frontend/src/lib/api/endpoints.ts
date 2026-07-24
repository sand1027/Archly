/**
 * All typed API calls to the Go backend.
 * Each function maps to one route from DESIGN.md section 6.
 */

import { api } from "./client";
import type { AuthUser, CommunityDesign, ShareLink } from "@/types";

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

export const designsApi = {
  list: (params?: { page?: number; pageSize?: number; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.tag)      qs.set("tag", params.tag);
    const query = qs.toString();
    return api.get<DesignsListResponse>(`/designs${query ? `?${query}` : ""}`);
  },

  get: (id: string) =>
    api.get<CommunityDesign>(`/designs/${id}`),

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
  designId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState?: Record<string, any>;
  ttlHours?: number;
}

export const shareApi = {
  create: (body: CreateShareRequest) =>
    api.post<ShareLink>("/share", body),

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

  diagramToCode: (body: DiagramToCodeRequest) =>
    api.post<DiagramToCodeResponse>("/v1/ai/diagram-to-code/generate", body),
};

// ─── Health ────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api.get<{ status: string; version: string }>("/health"),
};
