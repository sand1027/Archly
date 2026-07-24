"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WsClient, type WsClientStatus } from "@/lib/api/ws-client";
import { useCanvasStore } from "@/store/canvas.store";
import { useAuth } from "@/providers/auth-provider";
import type { WsMessage, ExcalidrawElement } from "@/types";

interface UseCollaborationOptions {
  roomId: string | null;
  enabled?: boolean;
}

export function useCollaboration({ roomId, enabled = true }: UseCollaborationOptions) {
  const client = useRef<WsClient | null>(null);
  const [status, setStatus] = useState<WsClientStatus>("disconnected");

  const { user } = useAuth();
  const {
    setElements,
    setAppState,
    setCollaborator,
    removeCollaborator,
    setRoomId,
  } = useCanvasStore();

  // Connect when roomId is set and user is authenticated
  useEffect(() => {
    if (!roomId || !enabled || !user) return;

    const ws = new WsClient(roomId);
    client.current = ws;
    setRoomId(roomId);

    // Handle incoming messages from other collaborators
    const unsub = ws.onMessage((msg: WsMessage) => {
      switch (msg.type) {
        case "element_update":
          setElements(msg.payload as ExcalidrawElement[]);
          break;
        case "cursor_move":
          setCollaborator(msg.payload);
          break;
        case "user_join":
          setCollaborator(msg.payload);
          break;
        case "user_leave":
          removeCollaborator(msg.payload.userId as string);
          break;
        case "full_state":
          setElements(msg.payload.elements as ExcalidrawElement[]);
          setAppState(msg.payload.appState);
          break;
      }
    });

    ws.onStatus(setStatus);
    ws.connect();

    // Announce join
    ws.send("user_join", {
      userId: user.id,
      displayName: user.displayName,
      color: stringToColor(user.id),
    });

    return () => {
      unsub();
      ws.destroy();
      client.current = null;
      setRoomId(null);
    };
  }, [roomId, enabled, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send element updates to collaborators (called from ExcalidrawWrapper onChange)
  const sendElementUpdate = useCallback(
    (elements: ExcalidrawElement[]) => {
      client.current?.send("element_update", elements);
    },
    []
  );

  // Send cursor position
  const sendCursorMove = useCallback(
    (x: number, y: number) => {
      if (!user) return;
      client.current?.send("cursor_move", {
        userId: user.id,
        displayName: user.displayName,
        color: stringToColor(user.id),
        x,
        y,
      });
    },
    [user]
  );

  return { status, sendElementUpdate, sendCursorMove };
}

// Deterministic color from a user ID string
function stringToColor(str: string): string {
  const COLORS = [
    "#6366f1", "#ec4899", "#f59e0b", "#22c55e",
    "#06b6d4", "#8b5cf6", "#f97316", "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
