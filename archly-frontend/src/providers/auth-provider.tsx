"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuthStore } from "@/store/auth.store";

export type UserTier = "free" | "plus" | "pro";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: UserTier;
  twitterHandle?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPro: boolean; // plus or pro tier
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const TOKEN_KEY = "pd-access-token";
export const USER_KEY = "pd-user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount — keep Zustand in sync for API client
  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const rawUser = localStorage.getItem(USER_KEY);
      if (token && rawUser) {
        const parsed = JSON.parse(rawUser) as AuthUser;
        setAccessToken(token);
        setUser(parsed);
        useAuthStore.getState().setAuth(token, parsed);
      } else {
        useAuthStore.getState().clearAuth();
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      useAuthStore.getState().clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((token: string, authUser: AuthUser) => {
    setAccessToken(token);
    setUser(authUser);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    useAuthStore.getState().setAuth(token, authUser);
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    useAuthStore.getState().clearAuth();
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      useAuthStore.getState().updateUser(updates);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user && !!accessToken,
        isPro: user?.tier === "plus" || user?.tier === "pro",
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
