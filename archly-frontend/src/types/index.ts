// ─── Re-export auth types ──────────────────────────────────────────────────
export type { AuthUser, UserTier } from "@/providers/auth-provider";

// ─── Canvas / Excalidraw ───────────────────────────────────────────────────

/** Mirrors ExcalidrawElement from @excalidraw/excalidraw */
export interface ExcalidrawElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: null | { type: number; value?: number };
  isDeleted: boolean;
  version: number;
  versionNonce: number;
  updated: number;
  link: string | null;
  locked: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type ExcalidrawElement = ExcalidrawElementBase;

// ─── Component library ────────────────────────────────────────────────────

export type ComponentCategory =
  | "clients"
  | "traffic_edge"
  | "compute"
  | "storage"
  | "messaging"
  | "observability"
  | "network"
  | "ai_agents"
  | "external";

export interface ComponentDefinition {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  color: string;          // background fill color
  strokeColor: string;
  icon: string;           // emoji or SVG path identifier
  tags: string[];
  defaultWidth: number;
  defaultHeight: number;
}

// ─── Simulation ───────────────────────────────────────────────────────────

export interface NodeMetrics {
  nodeId: string;
  rps: number;           // requests per second
  latencyAvg: number;    // ms
  latencyP99: number;    // ms
  throughput: number;    // bytes/s
  errorRate: number;     // 0–1
  cpuPercent: number;    // 0–100
  memPercent: number;    // 0–100
  isBottleneck: boolean;
}

export interface SimPacket {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  progress: number;      // 0–1 along the path
  isError: boolean;
  createdAt: number;     // timestamp
}

export type ChaosType =
  | "crash"
  | "slow"
  | "surge"
  | "partition"
  | "throttle"
  | "canary"
  | "zero";

export interface ChaosInjection {
  id: string;
  type: ChaosType;
  nodeId: string;
  params: {
    latencyMs?: number;       // for "slow"
    surgeMultiplier?: number; // for "surge"
    throttleKbps?: number;    // for "throttle"
    canaryPercent?: number;   // for "canary"
  };
  injectedAt: number;
}

export type BottleneckEntry = {
  nodeId: string;
  score: number;   // higher = worse
  reason: string;
};

// ─── Interview ────────────────────────────────────────────────────────────

export type InterviewDuration = 20 | 30 | 45 | 60;

export interface InterviewProblem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  durationMins: InterviewDuration;
  tags: string[];
  prompt: string;
  keyChallenge: string;
  referenceElementIds?: string[];  // IDs to show in diff dots
}

export type InterviewStatus = "idle" | "active" | "paused" | "ended";

// ─── Community ────────────────────────────────────────────────────────────

export interface CommunityDesign {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  tags: string[];
  forkCount: number;
  starCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  elements: ExcalidrawElement[];
}

// ─── Share ────────────────────────────────────────────────────────────────

export interface ShareLink {
  slug: string;
  designId: string;
  expiresAt: string;
  url: string;
}

// ─── WebSocket messages ───────────────────────────────────────────────────

export type WsMessageType =
  | "element_update"
  | "cursor_move"
  | "user_join"
  | "user_leave"
  | "full_state";

export interface WsMessage {
  type: WsMessageType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export interface CollaboratorCursor {
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
}
