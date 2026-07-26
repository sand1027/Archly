"use client";

import { create } from "zustand";

export type ToastKind = "info" | "success" | "warn" | "error";

export interface ToastItem {
  id: string;
  msg: string;
  kind: ToastKind;
  ttlMs: number;
}

interface ToastStore {
  items: ToastItem[];
  push: (msg: string, kind?: ToastKind, ttlMs?: number) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (msg, kind = "info", ttlMs = 2800) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ items: [...s.items.slice(-4), { id, msg, kind, ttlMs }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, ttlMs);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(msg: string, kind: ToastKind = "info", ttlMs = 2800) {
  useToastStore.getState().push(msg, kind, ttlMs);
}
