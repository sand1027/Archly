/**
 * WebSocket client for real-time collaboration rooms.
 * Connects to the Go WebSocket hub at /ws/room/:roomId
 *
 * Features:
 * - Auto-reconnect with exponential backoff (up to 30s)
 * - Typed message send/receive using WsMessage types
 * - Ping/pong keepalive every 30s
 * - Graceful cleanup on unmount
 */

import { getAccessToken } from "@/store/auth.store";
import type { WsMessage, WsMessageType } from "@/types";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS  = 30_000;
const PING_INTERVAL_MS  = 30_000;

type MessageHandler = (msg: WsMessage) => void;
type StatusHandler  = (status: WsClientStatus) => void;

export type WsClientStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export class WsClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private attempt = 0;
  private destroyed = false;

  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers  = new Set<StatusHandler>();

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  // ── Connect ──────────────────────────────────────────────────────────

  connect(): void {
    if (this.destroyed) return;
    this.emitStatus("connecting");

    const token = getAccessToken();
    const url = `${WS_BASE}/ws/room/${this.roomId}${
      token ? `?token=${encodeURIComponent(token)}` : ""
    }`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.emitStatus("connected");
      this.startPing();
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        this.messageHandlers.forEach((h) => h(msg));
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onerror = () => {
      this.emitStatus("error");
    };

    ws.onclose = () => {
      this.stopPing();
      if (!this.destroyed) {
        this.emitStatus("disconnected");
        this.scheduleReconnect();
      }
    };
  }

  // ── Send ─────────────────────────────────────────────────────────────

  send(type: WsMessageType, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, payload }));
  }

  // ── Subscribe ─────────────────────────────────────────────────────────

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  destroy(): void {
    this.destroyed = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.messageHandlers.clear();
    this.statusHandlers.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────

  private emitStatus(status: WsClientStatus): void {
    this.statusHandlers.forEach((h) => h(status));
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.attempt,
      RECONNECT_MAX_MS
    );
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
