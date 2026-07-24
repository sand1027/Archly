import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types";

/**
 * Zustand auth store — persisted to localStorage.
 *
 * This mirrors the AuthProvider context for non-React code paths
 * (e.g. the API client reading the token, the WS client, simulation engine).
 * The AuthProvider is the source of truth in React tree; this store is
 * the source of truth outside of it.
 */
export interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isPro: boolean;

  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isPro: false,

      setAuth: (token, user) =>
        set({
          accessToken: token,
          user,
          isAuthenticated: true,
          isPro: user.tier === "plus" || user.tier === "pro",
        }),

      clearAuth: () =>
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
          isPro: false,
        }),

      updateUser: (updates) =>
        set((s) => {
          if (!s.user) return s;
          const next = { ...s.user, ...updates };
          return {
            user: next,
            isPro: next.tier === "plus" || next.tier === "pro",
          };
        }),
    }),
    {
      name: "pd-auth",
      // Only persist the token + user — not derived booleans
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
      // Rehydrate derived booleans after loading from storage
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!state.accessToken && !!state.user;
          state.isPro =
            state.user?.tier === "plus" || state.user?.tier === "pro"
              ? true
              : false;
        }
      },
    }
  )
);

/** Read the token outside of React (e.g. in fetch interceptors) */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
