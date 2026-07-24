# PaperDraw Clone — Build Spec

## Stack Decision

```
paperdraw-clone/
├── frontend/          ← Next.js 14 (App Router) + TypeScript
└── backend/           ← Go (chi router, WebSocket, Redis)
```

**Why separate backend in Go:**
- WebSocket server for real-time collaboration needs persistent connections — Go handles 100k+ concurrent connections cheaply
- Simulation engine is CPU-bound packet calculation — Go is 5-10× faster than Node for this
- AI streaming proxy to OpenAI/Anthropic — Go's goroutines handle fan-out cleanly
- Frontend (Next.js) only does SSR + static pages + calls the Go API

---

## Project Structure

```
paperdraw-clone/
│
├── frontend/                          ← Next.js 14
│   ├── src/
│   │   ├── app/
│   │   │   ├── (canvas)/
│   │   │   │   └── page.tsx           ← Main canvas page
│   │   │   ├── community/
│   │   │   │   └── page.tsx           ← Community gallery
│   │   │   ├── interview/
│   │   │   │   └── page.tsx           ← Interview mode
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx               ← Landing / redirect
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── ExcalidrawWrapper.tsx
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   ├── ComponentPalette.tsx   ← Left sidebar: 45+ components
│   │   │   │   ├── PropertiesPanel.tsx    ← Right sidebar
│   │   │   │   └── SimulationBar.tsx      ← Bottom bar
│   │   │   ├── simulation/
│   │   │   │   ├── SimulationEngine.tsx
│   │   │   │   ├── PacketAnimator.tsx
│   │   │   │   ├── MetricsDisplay.tsx
│   │   │   │   └── ChaosPanel.tsx
│   │   │   ├── mermaid/
│   │   │   │   ├── MermaidEditor.tsx
│   │   │   │   └── MermaidToCanvas.tsx
│   │   │   ├── community/
│   │   │   │   ├── DesignCard.tsx
│   │   │   │   └── DesignGallery.tsx
│   │   │   └── interview/
│   │   │       ├── InterviewTimer.tsx
│   │   │       ├── ProblemPanel.tsx
│   │   │       └── InterviewMode.tsx
│   │   ├── lib/
│   │   │   ├── components-registry.ts  ← 45+ component definitions
│   │   │   ├── simulation/
│   │   │   │   ├── engine.ts           ← Core sim logic
│   │   │   │   ├── chaos.ts            ← 7 chaos types
│   │   │   │   ├── metrics.ts          ← RPS, latency, error rate
│   │   │   │   └── scenarios.ts        ← Pre-built chaos scenarios
│   │   │   ├── mermaid-to-excalidraw.ts
│   │   │   ├── presets.ts              ← Template architectures
│   │   │   └── api.ts                  ← Backend API client
│   │   └── types/
│   │       ├── canvas.ts
│   │       ├── simulation.ts
│   │       └── community.ts
│   ├── package.json
│   └── next.config.ts
│
├── backend/                            ← Go
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   │   ├── router.go              ← chi router
│   │   │   ├── handlers/
│   │   │   │   ├── designs.go         ← Community designs CRUD
│   │   │   │   ├── simulation.go      ← Simulation state API
│   │   │   │   ├── ai.go              ← AI text-to-diagram streaming
│   │   │   │   └── share.go           ← Share links
│   │   │   └── middleware/
│   │   │       ├── auth.go
│   │   │       ├── cors.go
│   │   │       └── ratelimit.go
│   │   ├── realtime/
│   │   │   ├── hub.go                 ← WebSocket hub
│   │   │   ├── client.go              ← WebSocket client
│   │   │   └── broadcast.go           ← /api/broadcast equivalent
│   │   ├── simulation/
│   │   │   ├── engine.go              ← Server-side sim validation
│   │   │   └── chaos.go
│   │   ├── db/
│   │   │   ├── postgres.go
│   │   │   └── migrations/
│   │   ├── cache/
│   │   │   └── redis.go
│   │   └── ai/
│   │       └── stream.go              ← Proxy to AI provider (streaming)
│   ├── go.mod
│   └── go.sum
│
├── docker-compose.yml                  ← postgres + redis + backend + frontend
└── SPEC.md                             ← this file
```

---

## Feature Breakdown

### Phase 1 — Canvas + Components (Week 1–2)

**Frontend only, no backend needed**

| Feature | Implementation |
|---------|---------------|
| Excalidraw canvas | `@excalidraw/excalidraw` package |
| Dark / Light mode | Excalidraw theme prop + `prefers-color-scheme` |
| Component palette (45+) | Custom sidebar with drag-to-canvas |
| Toolbar | Excalidraw built-in + custom buttons |
| Keyboard shortcuts | Excalidraw built-in + custom `useEffect` |
| Undo / Redo | Excalidraw built-in |
| Grid + snap | Excalidraw built-in |
| Export PNG/SVG | Excalidraw `exportToBlob` |
| Local save | `localStorage` / `IndexedDB` |

**Component registry — 45+ types with metadata:**
```ts
// lib/components-registry.ts
export const COMPONENTS = {
  infrastructure: [
    { id: 'api-gateway',    label: 'API Gateway',    icon: '🔀', color: '#0ea5e9' },
    { id: 'load-balancer',  label: 'Load Balancer',  icon: '⚖️', color: '#6366f1' },
    { id: 'cdn',            label: 'CDN',             icon: '🌐', color: '#8b5cf6' },
    { id: 'waf',            label: 'WAF / Firewall',  icon: '🛡️', color: '#ef4444' },
    { id: 'dns',            label: 'DNS',             icon: '📡', color: '#3b82f6' },
    { id: 'vpn-gateway',    label: 'VPN Gateway',     icon: '🔒', color: '#6b7280' },
  ],
  compute: [
    { id: 'service',        label: 'Service',         icon: '⚙️',  color: '#22c55e' },
    { id: 'worker',         label: 'Background Worker', icon: '🔧', color: '#84cc16' },
    { id: 'lambda',         label: 'Lambda / FaaS',   icon: '⚡', color: '#f59e0b' },
    { id: 'container',      label: 'Container',       icon: '📦', color: '#06b6d4' },
    { id: 'k8s-pod',        label: 'K8s Pod',         icon: '☸️', color: '#3b82f6' },
  ],
  data: [
    { id: 'postgres',       label: 'PostgreSQL',      icon: '🗄️', color: '#336791' },
    { id: 'redis',          label: 'Redis',           icon: '⚡', color: '#ef4444' },
    { id: 'kafka',          label: 'Kafka',           icon: '📬', color: '#f97316' },
    { id: 's3',             label: 'S3 / Object Store', icon: '🪣', color: '#f59e0b' },
    { id: 'cassandra',      label: 'Cassandra',       icon: '💾', color: '#1a9c3e' },
    { id: 'dynamodb',       label: 'DynamoDB',        icon: '⚡', color: '#f59e0b' },
    { id: 'elasticsearch',  label: 'Elasticsearch',   icon: '🔍', color: '#f9a825' },
    { id: 'vector-db',      label: 'Vector DB',       icon: '🧠', color: '#8b5cf6' },
    { id: 'message-queue',  label: 'Message Queue',   icon: '📬', color: '#f97316' },
    { id: 'dlq',            label: 'Dead Letter Queue', icon: '☠️', color: '#6b7280' },
  ],
  // ... networking, observability, ai, external
} as const
```

---

### Phase 2 — Simulation Engine (Week 2–3)

**Frontend only (client-side simulation)**

The simulation runs entirely in the browser — no backend round-trips for packet animation.

```
Simulation loop (requestAnimationFrame):
  1. Read canvas nodes + edges (Excalidraw elements)
  2. Map edges to traffic paths
  3. Spawn packets at source nodes based on RPS
  4. Animate packets along bezier paths
  5. Apply latency delay at each node
  6. Apply error rate (drop some packets)
  7. Update per-node metrics (running average)
  8. Detect bottlenecks (queue depth > threshold)
```

**Chaos types implementation:**
```ts
// lib/simulation/chaos.ts
export type ChaosType =
  | 'crash'       // remove node from graph → packets drop
  | 'slow'        // add Xms delay to node
  | 'surge'       // multiply incoming RPS by 10×
  | 'partition'   // cut all edges to/from node
  | 'throttle'    // bandwidth cap → packet queue builds
  | 'canary'      // split traffic 95/5 or 0/100 misconfiguration
  | 'zero-weight' // node in pool but receives 0 traffic
```

**Simulation bar (bottom):**
- Total RPS counter (animated)
- Avg latency
- Error rate (red when >1%)
- Nodes count
- Edges count
- Play / Pause / Reset
- Speed: 0.1× – 5×
- Chaos button → opens chaos panel

---

### Phase 3 — Mermaid Integration (Week 3)

**Frontend only**

```ts
// lib/mermaid-to-excalidraw.ts
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

export async function mermaidToCanvas(mermaidCode: string) {
  const { elements, files } = await parseMermaidToExcalidraw(mermaidCode)
  return convertToExcalidrawElements(elements)
}
```

Supported diagram types (all from the bundled mermaid v11):
- `flowchart` / `graph`
- `sequenceDiagram`
- `classDiagram`
- `erDiagram`
- `stateDiagram-v2`
- `gantt`
- `gitGraph`
- `mindmap`
- `C4Context`
- `architecture`
- `timeline`
- `sankey`
- `quadrantChart`
- `xychart`
- `kanban`
- `treemap`
- `radar-beta`
- `packet`
- `block`
- `pie`

**Mermaid editor panel:**
- Monaco-style textarea with syntax highlighting
- Live preview
- "Add to canvas" button
- Error display inline

---

### Phase 4 — AI Text-to-Diagram (Week 3–4)

**Requires backend**

```
POST /api/v1/ai/text-to-diagram/stream
  Body: { prompt: string, context?: string }
  Response: Server-Sent Events (SSE)
    → streams mermaid code token by token
    → final event contains complete mermaid
    → frontend parses mermaid → adds to canvas
```

**Go backend (`internal/ai/stream.go`):**
```go
func (h *Handler) StreamDiagram(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    
    // Proxy to OpenAI/Anthropic with streaming
    // System prompt instructs model to output valid Mermaid syntax
    // Stream tokens back to client via SSE
}
```

---

### Phase 5 — Community Designs (Week 4)

**Requires backend + DB**

**DB schema (PostgreSQL):**
```sql
CREATE TABLE designs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,    -- 'microservices' | 'real-time' | 'ml-ai' | ...
  author_id   UUID,
  elements    JSONB NOT NULL,   -- Excalidraw elements JSON
  thumbnail   TEXT,             -- base64 or storage URL
  fork_count  INT DEFAULT 0,
  star_count  INT DEFAULT 0,
  is_public   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE design_forks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id    UUID REFERENCES designs(id),
  forked_by    UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**Go API routes:**
```
GET    /api/v1/designs              ← list community designs (paginated)
GET    /api/v1/designs/:id          ← get single design + elements
POST   /api/v1/designs              ← publish design (auth required)
POST   /api/v1/designs/:id/fork     ← fork to your canvas
GET    /api/v1/designs/categories   ← list categories
```

**Pre-seeded designs (10 templates):**
1. Twitter-scale feed (fan-out on write, Redis, Cassandra)
2. Uber ride matching (WebSocket, geolocation, Kafka)
3. Netflix CDN + streaming
4. URL shortener
5. Chat app with Redis pub/sub
6. Video upload + transcoding pipeline
7. ML Feature Store
8. Payment system with circuit breaker
9. Dropbox / file sync with block deduplication
10. Pastebin / code share

---

### Phase 6 — Real-time Collaboration (Week 5)

**Requires backend WebSocket**

**Go WebSocket hub (`internal/realtime/hub.go`):**
```go
type Hub struct {
    rooms   map[string]*Room   // roomID → clients
    mu      sync.RWMutex
}

type Room struct {
    clients map[*Client]bool
    state   []byte              // current canvas state (CRDT-like)
}

// On client connect → send current state
// On client message → broadcast to all other clients in room
// Message types: element_update | cursor_move | user_join | user_leave
```

**Frontend WebSocket client:**
```ts
// lib/collaboration.ts
const ws = new WebSocket(`wss://api.paperdraw.dev/rooms/${roomId}`)

ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data)
  if (type === 'element_update') {
    excalidrawAPI.updateScene({ elements: payload.elements })
  }
  if (type === 'cursor_move') {
    updateCollaboratorCursor(payload.userId, payload.x, payload.y)
  }
}
```

---

### Phase 7 — Interview Mode (Week 5–6)

**Frontend only**

```ts
// Interview mode state
interface InterviewSession {
  problem: InterviewProblem
  timeLimit: number         // minutes
  startedAt: Date
  elapsed: number           // seconds
  status: 'idle' | 'active' | 'paused' | 'done'
}

// 10 classic system design problems:
const INTERVIEW_PROBLEMS = [
  { id: 'twitter',    title: 'Design Twitter',         timeLimit: 45 },
  { id: 'uber',       title: 'Design Uber',            timeLimit: 45 },
  { id: 'netflix',    title: 'Design Netflix',         timeLimit: 45 },
  { id: 'whatsapp',   title: 'Design WhatsApp',        timeLimit: 40 },
  { id: 'youtube',    title: 'Design YouTube',         timeLimit: 45 },
  { id: 'dropbox',    title: 'Design Dropbox',         timeLimit: 40 },
  { id: 'tinyurl',    title: 'Design TinyURL',         timeLimit: 30 },
  { id: 'instagram',  title: 'Design Instagram',       timeLimit: 45 },
  { id: 'rate-limiter', title: 'Design a Rate Limiter', timeLimit: 35 },
  { id: 'search',     title: 'Design Google Search',  timeLimit: 45 },
]
```

**UI:**
- Left panel slides in with problem statement
- Countdown timer (big, top-right)
- Pause / Resume
- "End Interview" → shows canvas summary
- Hints button (AI-powered suggestions)

---

### Phase 8 — Share Links (Week 6)

**Requires backend**

```
POST /api/v1/share
  Body: { elements: ExcalidrawElement[], appState: AppState }
  Response: { shareId: string, url: string }

GET /api/v1/share/:shareId
  Response: { elements, appState, createdAt }
```

Share links stored in Redis with 30-day TTL, or in Postgres for permanent links.

---

## Backend API — Full Route Table

```
Auth
  POST   /api/v1/auth/login
  POST   /api/v1/auth/register
  POST   /api/v1/auth/refresh
  POST   /api/v1/auth/logout

Community Designs
  GET    /api/v1/designs
  GET    /api/v1/designs/:id
  POST   /api/v1/designs
  PATCH  /api/v1/designs/:id
  DELETE /api/v1/designs/:id
  POST   /api/v1/designs/:id/fork
  POST   /api/v1/designs/:id/star

Share Links
  POST   /api/v1/share
  GET    /api/v1/share/:id

AI
  POST   /api/v1/ai/text-to-diagram/stream   ← SSE
  POST   /api/v1/ai/chaos-suggestions        ← given canvas, suggest chaos

WebSocket
  WS     /api/v1/rooms/:roomId               ← real-time collaboration

Health
  GET    /health
```

---

## Environment Variables

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Backend (`backend/.env`)
```env
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/paperdraw
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
JWT_SECRET=your-jwt-secret
CORS_ORIGINS=http://localhost:3000
```

---

## Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: paperdraw
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    ports: ["8080:8080"]
    depends_on: [postgres, redis]
    env_file: ./backend/.env

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    env_file: ./frontend/.env.local

volumes:
  pgdata:
```

---

## Build Order (8 Weeks)

| Week | What you build | Output |
|------|---------------|--------|
| 1 | Next.js setup + Excalidraw canvas + Component palette | Canvas with drag-drop components |
| 2 | Simulation engine + packet animation + chaos panel | Live simulation running |
| 3 | Mermaid editor + mermaid-to-canvas + AI streaming | Text-to-diagram working |
| 4 | Go backend scaffolding + DB + community designs API | Community gallery loading real data |
| 5 | WebSocket real-time collaboration | 2 tabs syncing in real-time |
| 6 | Interview mode + timers + problem bank | Full interview flow |
| 7 | Share links + auth + Paperdraw+ paywall | End-to-end user flow |
| 8 | Polish, performance, deploy (Vercel + Railway/Fly.io) | Shipped |

---

## Key NPM Packages (Frontend)

```json
{
  "@excalidraw/excalidraw": "^0.17.x",
  "@excalidraw/mermaid-to-excalidraw": "^0.3.x",
  "mermaid": "^11.x",
  "zustand": "^5.x",
  "react-query": "^5.x",
  "framer-motion": "^11.x",
  "monaco-editor": "^0.45.x",
  "next": "^14.x",
  "typescript": "^5.x",
  "tailwindcss": "^3.x",
  "shadcn-ui": "latest"
}
```

## Key Go Packages (Backend)

```go
require (
  github.com/go-chi/chi/v5        v5.1.0
  github.com/go-chi/cors          v1.2.1
  github.com/jackc/pgx/v5         v5.6.0
  github.com/redis/go-redis/v9    v9.6.0
  github.com/golang-jwt/jwt/v5    v5.2.1
  github.com/gorilla/websocket    v1.5.3
  golang.org/x/sync               v0.8.0
)
```

---

## What Goes Where — Decision Summary

| Feature | Where | Why |
|---------|-------|-----|
| Canvas rendering | Frontend (client) | Excalidraw runs in browser |
| Simulation engine | Frontend (client) | 60fps animation needs requestAnimationFrame |
| Chaos injection logic | Frontend (client) | Real-time, no latency |
| Mermaid parsing | Frontend (client) | Library already runs in browser |
| AI text-to-diagram | Backend (Go) → proxy | Need to hide API keys |
| Community designs | Backend (Go) + Postgres | Persistent, shared data |
| Real-time collaboration | Backend (Go) WebSocket | Needs central hub |
| Share links | Backend (Go) + Redis | Short-lived server-side state |
| Auth | Backend (Go) + Postgres | JWT validation, sessions |
| Presets / templates | Frontend (client) | Just JSON constants, no DB needed |
