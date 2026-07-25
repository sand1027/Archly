"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  designsApi,
  type PublishDesignRequest,
  type SaveDesignRequest,
} from "@/lib/api/endpoints";
import type { CommunityDesign } from "@/types";

// ─── Query keys ────────────────────────────────────────────────────────────

export const designKeys = {
  all:    ()         => ["designs"]                     as const,
  list:   (params?:object) => ["designs", "list", params ?? {}] as const,
  mine:   (params?:object) => ["designs", "mine", params ?? {}] as const,
  detail: (id: string)     => ["designs", "detail", id]         as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useDesigns(params?: {
  page?: number;
  pageSize?: number;
  tag?: string;
  q?: string;
}) {
  return useQuery({
    queryKey: designKeys.list(params),
    queryFn: () => designsApi.list(params),
  });
}

export function useDesign(
  id: string,
  options?: Omit<UseQueryOptions<CommunityDesign>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: designKeys.detail(id),
    queryFn: () => designsApi.get(id),
    enabled: !!id,
    ...options,
  });
}

export function usePublishDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PublishDesignRequest) => designsApi.publish(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: designKeys.all() }),
  });
}

// ─── My saved sessions (history) ─────────────────────────────────────────────

export function useMyDesigns(
  params?: { page?: number; pageSize?: number },
  enabled = true
) {
  return useQuery({
    queryKey: designKeys.mine(params),
    queryFn: () => designsApi.mine(params),
    enabled,
  });
}

export function useSaveDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveDesignRequest) => designsApi.save(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: designKeys.all() }),
  });
}

export function useUpdateDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SaveDesignRequest }) =>
      designsApi.saveUpdate(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: designKeys.all() }),
  });
}

export function useForkDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => designsApi.fork(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: designKeys.all() }),
  });
}

export function useStarDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => designsApi.star(id),
    onSuccess: (_data, id) =>
      qc.invalidateQueries({ queryKey: designKeys.detail(id) }),
  });
}

export function useDeleteDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => designsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: designKeys.all() }),
  });
}
