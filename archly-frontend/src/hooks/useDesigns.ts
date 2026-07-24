"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { designsApi, type PublishDesignRequest } from "@/lib/api/endpoints";
import type { CommunityDesign } from "@/types";

// ─── Query keys ────────────────────────────────────────────────────────────

export const designKeys = {
  all:    ()         => ["designs"]                     as const,
  list:   (params?:object) => ["designs", "list", params ?? {}] as const,
  detail: (id: string)     => ["designs", "detail", id]         as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useDesigns(params?: { page?: number; pageSize?: number; tag?: string }) {
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
