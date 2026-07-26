"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { authApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/store/auth.store";
import type { AuthUser } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { resolvedTheme } = useTheme();
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const isDark = resolvedTheme === "dark";

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--pd-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Assistant, sans-serif",
      padding: "24px 16px",
    }}>
      {/* Logo */}
      <Link href="/canvas" aria-label="Archly" style={{
        display: "flex", alignItems: "center",
        textDecoration: "none", marginBottom: 28,
      }}>
        <img
          src="/brand-navbar.png"
          alt="Archly"
          height={40}
          width={159}
          draggable={false}
          style={{
            height: 40,
            width: "auto",
            display: "block",
            filter: isDark ? undefined : "invert(1) hue-rotate(180deg)",
          }}
        />
      </Link>

      <div style={{
        width: "100%", maxWidth: 420,
        background: "var(--pd-surface)",
        border: "1px solid var(--pd-border)",
        borderRadius: 14,
        boxShadow: "var(--pd-shadow-lg)",
        overflow: "hidden",
        position: "relative",
      }}>
        <Link
          href="/canvas"
          aria-label="Close"
          title="Back to canvas"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "1px solid var(--pd-border)",
            background: "var(--pd-bg)",
            color: "var(--pd-text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ✕
        </Link>

        {/* Tab bar */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--pd-border)",
          paddingRight: 40,
        }}>
          {(["signup", "login"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "14px 0",
                border: "none", background: "transparent",
                fontSize: 13, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? "var(--pd-brand)" : "var(--pd-text-muted)",
                cursor: "pointer",
                borderBottom: tab === t ? "2px solid var(--pd-brand)" : "2px solid transparent",
                transition: "all 120ms",
              }}
            >
              {t === "signup" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>

        <div style={{ padding: "28px 32px 32px" }}>
          {tab === "signup"
            ? <SignUpForm onSuccess={(token, user) => {
                login(token, user);
                useAuthStore.getState().setAuth(token, user);
                router.push("/canvas");
              }} />
            : <SignInForm onSuccess={(token, user) => {
                login(token, user);
                useAuthStore.getState().setAuth(token, user);
                router.push("/canvas");
              }} />
          }
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--pd-text-subtle)" }}>
        Free forever · No credit card required
      </p>
    </main>
  );
}

// ─── Sign Up ──────────────────────────────────────────────────────────────

function SignUpForm({ onSuccess }: { onSuccess: (token: string, user: AuthUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authApi.register({
        email: email.trim(),
        password,
        display_name: name.trim(),
      });
      // Backend returns snake_case — map to camelCase for the auth store
      const user: AuthUser = {
        id:          (res as unknown as { user: { id: string } }).user?.id ?? "",
        email:       (res as unknown as { user: { email: string } }).user?.email ?? email,
        displayName: (res as unknown as { user: { display_name: string } }).user?.display_name ?? name,
        tier:        ((res as unknown as { user: { tier: string } }).user?.tier ?? "free") as AuthUser["tier"],
        avatarUrl:   (res as unknown as { user: { avatar_url?: string } }).user?.avatar_url,
      };
      const token = (res as unknown as { access_token: string }).access_token ?? res.accessToken;
      onSuccess(token, user);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Registration failed";
      setError(msg.includes("EMAIL_TAKEN") || msg.toLowerCase().includes("already")
        ? "That email is already registered. Try signing in."
        : msg
      );
    } finally {
      setLoading(false);
    }
  }, [name, email, password, onSuccess]);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Your name" htmlFor="name">
        <input
          id="name" type="text" autoComplete="name" required
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          className="pd-input"
          style={{ fontSize: 14 }}
        />
      </Field>

      <Field label="Email" htmlFor="email-signup">
        <input
          id="email-signup" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="pd-input"
          style={{ fontSize: 14 }}
        />
      </Field>

      <Field label="Password" htmlFor="password-signup">
        <input
          id="password-signup" type="password" autoComplete="new-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          className="pd-input"
          style={{ fontSize: 14 }}
        />
      </Field>

      {error && <ErrorBox msg={error} />}

      <button
        type="submit"
        disabled={loading || !name.trim() || !email.trim() || !password}
        style={submitBtnStyle(loading || !name.trim() || !email.trim() || !password)}
      >
        {loading ? "Creating account…" : "Create free account →"}
      </button>
    </form>
  );
}

// ─── Sign In ──────────────────────────────────────────────────────────────

function SignInForm({ onSuccess }: { onSuccess: (token: string, user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      const user: AuthUser = {
        id:          (res as unknown as { user: { id: string } }).user?.id ?? "",
        email:       (res as unknown as { user: { email: string } }).user?.email ?? email,
        displayName: (res as unknown as { user: { display_name: string } }).user?.display_name ?? "",
        tier:        ((res as unknown as { user: { tier: string } }).user?.tier ?? "free") as AuthUser["tier"],
        avatarUrl:   (res as unknown as { user: { avatar_url?: string } }).user?.avatar_url,
      };
      const token = (res as unknown as { access_token: string }).access_token ?? res.accessToken;
      onSuccess(token, user);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Sign in failed";
      setError(msg.includes("INVALID_CREDENTIALS") || msg.toLowerCase().includes("invalid")
        ? "Incorrect email or password."
        : msg
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, onSuccess]);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Email" htmlFor="email-login">
        <input
          id="email-login" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="pd-input"
          style={{ fontSize: 14 }}
        />
      </Field>

      <Field label="Password" htmlFor="password-login">
        <input
          id="password-login" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className="pd-input"
          style={{ fontSize: 14 }}
        />
      </Field>

      {error && <ErrorBox msg={error} />}

      <button
        type="submit"
        disabled={loading || !email.trim() || !password}
        style={submitBtnStyle(loading || !email.trim() || !password)}
      >
        {loading ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────

function Field({ label, htmlFor, children }: {
  label: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 12, fontWeight: 600, color: "var(--pd-text-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: "var(--pd-radius)",
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: "var(--pd-sim-error)",
      fontSize: 13,
    }}>
      {msg}
    </div>
  );
}

function submitBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "11px 0",
    borderRadius: "var(--pd-radius)",
    border: "none",
    background: disabled
      ? "var(--pd-bg-muted)"
      : "linear-gradient(135deg, #5b5ef4, #7c3aed)",
    color: disabled ? "var(--pd-text-subtle)" : "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 150ms",
    opacity: disabled ? 0.7 : 1,
    boxShadow: disabled ? "none" : "0 2px 8px rgba(91,94,244,0.35)",
    marginTop: 4,
  };
}
