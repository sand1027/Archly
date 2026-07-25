/**
 * Typed fetch wrapper that calls the Go backend.
 *
 * All API calls in the app go through here so:
 * - Base URL is read from NEXT_PUBLIC_API_URL in one place
 * - JWT token is attached automatically from the auth store
 * - Errors are surfaced consistently as ApiError instances
 * - Response bodies are typed via generics
 */

import { getAccessToken } from "@/store/auth.store";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Error type ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isRateLimit() {
    return this.status === 429;
  }
}

// ─── Response shape from Go backend ───────────────────────────────────────

interface ApiErrorBody {
  code: string;
  message: string;
}

// ─── Core fetch ───────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.code ?? code;
      message = body.message ?? message;
    } catch {
      // non-JSON error body — keep defaults
    }
    throw new ApiError(res.status, code, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
};

// ─── SSE helper (for AI text-to-diagram streaming) ────────────────────────

/**
 * Opens a Server-Sent Events connection to the Go backend.
 * Calls onChunk for each data chunk, onDone when the stream ends.
 * Returns an AbortController so the caller can cancel.
 */
export function apiStream(
  path: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): AbortController {
  const controller = new AbortController();
  const token = getAccessToken();

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // Try to parse the JSON error body for a meaningful message
        try {
          const errBody = await res.json() as { code?: string; message?: string };
          throw new ApiError(
            res.status,
            errBody.code ?? "STREAM_ERROR",
            errBody.message ?? res.statusText
          );
        } catch (jsonErr) {
          if (jsonErr instanceof ApiError) throw jsonErr;
          throw new ApiError(res.status, "STREAM_ERROR", res.statusText);
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // Buffer for incomplete SSE lines across chunks
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines (\n\n)
        const events = buffer.split("\n\n");
        // Keep the last (potentially incomplete) event in the buffer
        buffer = events.pop() ?? "";

        for (const event of events) {
          // Collect all data: lines in this event and join with \n
          const dataLines = event
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6)); // strip "data: " prefix

          if (dataLines.length === 0) continue;

          const payload = dataLines.join("\n");

          if (payload === "[DONE]") {
            onDone();
            return;
          }
          onChunk(payload);
        }
      }

      onDone();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}

// ─── Named SSE helper (canvas chat: token + actions events) ───────────────

export type ChatStreamHandlers = {
  onToken: (chunk: string) => void;
  onActions: (actionsJson: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
};

/**
 * SSE client that understands `event: token` / `event: actions` plus `data: [DONE]`.
 */
export function apiChatStream(
  path: string,
  body: unknown,
  handlers: ChatStreamHandlers
): AbortController {
  const controller = new AbortController();
  const token = getAccessToken();

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let detail = res.statusText;
        try {
          const j = await res.json();
          if (j?.message) detail = j.message;
        } catch {
          /* ignore */
        }
        throw new ApiError(res.status, "STREAM_ERROR", detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          if (!event.trim()) continue;

          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of event.split("\n")) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            }
          }
          if (dataLines.length === 0) continue;
          const payload = dataLines.join("\n");

          if (payload === "[DONE]") {
            handlers.onDone();
            return;
          }

          if (eventName === "actions") {
            handlers.onActions(payload);
          } else {
            // token or default data chunks
            handlers.onToken(payload);
          }
        }
      }

      handlers.onDone();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      handlers.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}
