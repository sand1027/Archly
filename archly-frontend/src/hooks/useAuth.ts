"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useAuthStore } from "@/store/auth.store";
import { authApi, type LoginRequest, type RegisterRequest } from "@/lib/api/endpoints";

export function useLogin() {
  const { login: ctxLogin } = useAuth();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: ({ accessToken, user }) => {
      // Sync both the React context and the Zustand store
      ctxLogin(accessToken, user);
      setAuth(accessToken, user);
    },
  });
}

export function useRegister() {
  const { login: ctxLogin } = useAuth();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: ({ accessToken, user }) => {
      ctxLogin(accessToken, user);
      setAuth(accessToken, user);
    },
  });
}

export function useLogout() {
  const { logout: ctxLogout } = useAuth();
  const { clearAuth } = useAuthStore();

  return () => {
    ctxLogout();
    clearAuth();
  };
}
