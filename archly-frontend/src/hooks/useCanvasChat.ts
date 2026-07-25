"use client";

import { useState, useCallback, useRef } from "react";
import { apiChatStream } from "@/lib/api/client";
import { aiApi } from "@/lib/api/endpoints";
import {
  buildDiagramSnapshot,
  selectionHint,
  type CanvasKind,
  type DiagramSnapshot,
} from "@/lib/ai/diagram-snapshot";
import { applyChatActions, type ChatAction, type ActionResult } from "@/lib/ai/chat-actions";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionResults?: ActionResult[];
}

interface UseCanvasChatOptions {
  canvas: CanvasKind;
  /** When false, skip live snapshot work (panel closed). */
  enabled?: boolean;
}

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useCanvasChat({ canvas, enabled = true }: UseCanvasChatOptions) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef<DiagramSnapshot | null>(null);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      abortRef.current?.abort();
      setError(null);

      const snapshot = buildDiagramSnapshot(canvas);
      snapshotRef.current = snapshot;

      const hint = selectionHint(snapshot);
      const contentForModel = hint
        ? `${trimmed}\n\n(Context: ${hint})`
        : trimmed;

      const userTurn: ChatTurn = { id: newId(), role: "user", content: trimmed };
      const assistantId = newId();

      setMessages((prev) => [
        ...prev,
        userTurn,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);

      const history = [...messages, userTurn].map((m) => ({
        role: m.role,
        content: m.role === "user" && m.id === userTurn.id ? contentForModel : m.content,
      }));

      let accumulated = "";
      let pendingActions: ChatAction[] = [];

      const controller = apiChatStream(
        aiApi.canvasChatPath,
        {
          messages: history,
          diagram: snapshot,
          canvas,
        },
        {
          onToken: (chunk) => {
            accumulated += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              )
            );
          },
          onActions: (actionsJson) => {
            try {
              const parsed = JSON.parse(actionsJson) as { actions?: ChatAction[] };
              pendingActions = Array.isArray(parsed.actions) ? parsed.actions : [];
            } catch {
              pendingActions = [];
            }
          },
          onDone: () => {
            setIsStreaming(false);
            const snap = snapshotRef.current;
            if (pendingActions.length > 0 && snap) {
              const results = applyChatActions(pendingActions, snap);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: accumulated.trim(), actionResults: results }
                    : m
                )
              );
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated.trim() } : m
                )
              );
            }
          },
          onError: (err) => {
            setIsStreaming(false);
            setError(err.message);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        accumulated.trim() ||
                        "Sorry — I couldn’t reach the AI service. Try again.",
                    }
                  : m
              )
            );
          },
        }
      );

      abortRef.current = controller;
    },
    [canvas, isStreaming, messages]
  );

  const liveHint = enabled ? selectionHint(buildDiagramSnapshot(canvas)) : null;

  return {
    messages,
    isStreaming,
    error,
    send,
    cancel,
    clear,
    selectionHint: liveHint,
  };
}
