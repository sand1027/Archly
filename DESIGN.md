# PaperDraw — System Design & Architecture

> **Stack:** Next.js 14 (App Router) · Go + Chi · PostgreSQL · Redis · Kafka + Zookeeper · Docker · Turborepo
> **Source:** Reverse-engineered from `index.js`, `mermaid-to-draw.js`, `index.css` + paperdraw.dev

---

## Table of Contents

1. [What PaperDraw Is](#1-what-paperdraw-is)
2. [Feature Map](#2-feature-map)
3. [Stack Decisions](#3-stack-decisions)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Design](#7-database-design)
8. [Kafka Topics](#8-kafka-topics)
9. [Real-time Collaboration](#9-real-time-collaboration)
10. [Codegen Pipeline](#10-codegen-pipeline)
11. [AI Features](#11-ai-features)
12. [Pricing Tiers](#12-pricing-tiers)
13. [Docker Setup](#13-docker-setup)
14. [Environment Variables](#14-environment-variables)
15. [Key Commands](#15-key-commands)
16. [Build Order (Phases)](#16-build-order-phases)

---

## 1. What PaperDraw Is

PaperDraw is a browser-based system design tool. It combines:

- An **Excalidraw canvas** (hand-drawn whiteboard) with a curated library of 45+ infrastructure components
- A **live traffic simulation engine** that animates packets through your architecture and surfaces bottlenecks
- A **chaos engineering panel** with 7 injection types and 30+ application-level sub-scenarios
- A **Mermaid → diagram converter** that renders text diagrams onto the Excalidraw canvas
- An **AI text-to-diagram** feature (SSE streaming, backed by OpenAI)
- An **interview mode** with timed sessions and a bank of system design problems
- A **community gallery** where users publish and fork system designs
- A **Paperdraw+** paid tier for unlimited simulation, full chaos toolkit, real-time collab, and team workspaces

---

## 2. Feature Map

### 2.1 Canvas (Excalidraw)

Full Excalidraw canvas — shapes, text, arrows, freehand, sticky notes, hand-drawn roughjs rendering.
Dark mode / light mode (respects `prefers-color-scheme`).
Grid, snap, zoom, pan, undo/redo, multi-select, group, lock, align.
Background color picker, eye-dropper, canvas export (PNG / SVG / clipboard).
Keyboard shortcuts: `Alt+/`, `Alt+R`, `Alt+S`, `Alt+Z`, `Alt+Arrow`, `Alt+Shift+D`, and more.
Copy link / share. Save / load (local + cloud).

### 2.2 Component Library (45+ components)

| Category | Components |
|---|---|
| **Gateway / Edge** | API Gateway, Load Balancer, CDN, WAF, DNS, VPN Gateway, NAT Gateway |
| **Compute** | Application Server / Microservice, Background Worker, Lambda / Serverless, Container, Kubernetes Pod / Ingress |
| **Data stores** | PostgreSQL, Redis, Kafka, Object Store (S3), Cassandra, DynamoDB / DAX, Elasticsearch, Vector DB, Graph DB, Data Warehouse, Time Series DB, Columnar OLAP |
| **Messaging** | Message Queue (SQS/RabbitMQ), Dead Letter Queue, Stream Processor, Pub/Sub Broker (SNS/Pub Sub) |
| **Networking** | VPC, Firewall, Service Mesh (Istio/Envoy), Sidecar Proxy, Consistent Hash Ring |
| **Observability** | Metrics Collector, Trace Collector, Log Aggregator, Alert Manager |
| **AI/ML** | ML Model, Feature Store (online + offline), Embedding Index, Fine-Tuned Model |
| **External** | Payment Processor (Stripe/PayPal), Email / Notification Service, OAuth Provider, 3rd Party API |
| **Auth** | Auth Service, Rate Limiter, Cache (Cache-Aside), Distributed Lock |

### 2.3 Simulation Engine

- Adjustable **traffic multiplier** (0.1× – 5×) and configurable **simulation speed**
- Animated packet flow through the architecture at up to 60fps (client-side, no backend round-trip)
- **Per-node metrics:** RPS, latency (avg + p99), throughput, error rate, CPU, memory
- **Bottleneck Ranking** — surfaces the top bottleneck nodes automatically
- **Circuit breaker and retry storm modeling**
- **N+1 query detection**, connection pool exhaustion, cold start latency on scale-out
- Hot shard / hot partition, consumer group rebalance, cache stampede modeling
- Free tier: starter simulations. Paperdraw+: unlimited runs

### 2.4 Chaos Engineering (7 types + 30+ sub-scenarios)

**Infrastructure-Level Chaos:**

| Type | What it injects |
|---|---|
| **Crash** | Node process crash / OOM kill — `CRASHED — NO FAILOVER` |
| **Slow** | Latency injection (+Xms, configurable) — `Bandwidth Throttle` |
| **Surge** | Traffic spike (×10 burst) — `Burst Rate Limit Exhausted` |
| **Partition** | Network partition between nodes |
| **Throttle** | Bandwidth throttle / rate limit — `Bandwidth Throttled (Egress Limit)` |
| **Canary** | Traffic split misconfiguration — `Canary Traffic Asymmetry` |
| **Zero-weight** | Node in pool but receives no traffic |

**Application-Level Chaos (30+ sub-scenarios from source):**

- Circuit Breaker Open — blocking all outbound requests to protect downstream
- Retry Storm — client retries amplify load on an already-struggling node
- DLQ overflow (poison pill message)
- Cache Stampede — eviction blast + cache warming race
- Cache Eviction Storm, Cache OOM Eviction Surge, Cache Poisoning, Cache Sentinel Split
- Hot Key Eviction, Cache-Key Explosion, Cache Connection Storm
- Token refresh race condition — 401 burst under concurrency (no distributed lock)
- Bot Traffic Flood — upstream callers see 429s
- Schema registry incompatibility (Kafka consumer/producer version mismatch)
- Idempotency key missing on retry
- Consumer Rebalance — `max.poll.interval.ms` exceeded
- Cold Start Latency on Worker Scale-Out
- Session Affinity Broken on Scale Event
- Authentication Service Failure
- Query Plan Regression — planner picks a worse plan after stats refresh
- Cartesian Product Risk — missing JOIN condition
- Concurrency-Scaling Throttle — queries queue instead of scaling out
- Connection Pool Starvation (Downstream)
- Notification DLQ Swell, Notification Channel Down
- Model Cold Start / Loading Latency
- ANN Query Timeout (Approximate Nearest Neighbour)
- Payment Gateway Timeout, Acquirer Circuit Open
- CDN Cache Replica Desync (CDN-001 through CDN-007 scenario codes)
- AOF persistence fsync spike — 10-100× write latency
- OS lacks free memory to fork for RDB snapshot (`BGSAVE` fails)
- Broker Restart Cascade, Consumer Crash Loop

### 2.5 Mermaid Integration

Full **Mermaid v11 → Excalidraw** conversion (custom `mermaid-to-excalidraw` bundled in `mermaid-to-draw.js`).

Supports all Mermaid diagram types: `flowchart`, `sequenceDiagram`, `classDiagram`, `erDiagram`,
`stateDiagram`, `gantt`, `pie`, `gitGraph`, `mindmap`, `C4Context`, `kanban`, `timeline`,
`sankey`, `quadrantChart`, `packet`, `radar`, `block`, `architecture`, `xychart`, `treemap`.

Mermaid config: `startOnLoad: false`, `maxEdges: 500`, `maxTextSize: 50000`.
Syntax error detection with inline feedback.

### 2.6 AI Features

- **AI text-to-diagram** — describe your architecture in plain text → diagram rendered on canvas
  - API route: `POST /v1/ai/text-to-diagram/chat-streaming` (SSE streaming)
- **AI diagram-to-code** — reverse: diagram → infrastructure code
  - API route: `POST /v1/ai/diagram-to-code/generate`
- Per-component **context-aware suggestions**: "Add circuit breaker", "Add Load Balancer", "Add read replica"
- **Free tier:** daily AI limit — "You've hit your AI limit on the free plan. Try Paperdraw+ for more or come back tomorrow."
- Paperdraw+: unlimited AI diagram generation

### 2.7 Interview Mode

A timed system design interview practice environment (CSS class: `imd-*`).

**Problem bank includes:**

| Problem | Key challenge surfaced |
|---|---|
| Twitter / X Feed | Fan-out on write vs read; celebrity accounts (50M+ followers) |
| URL Shortener | CDN for popular URLs, DB for rare ones; 301 vs 302 |
| Video Streaming (YouTube/Netflix) | CDN absorbs 90%+ bytes; adaptive bitrate (HLS/DASH); async transcoding pipeline |
| Ride-Sharing (Uber) | WebSocket for location; consistent hash for geo sharding; Kafka for events |
| Chat / Messaging App | Fan-out for groups is the same problem as Twitter; consistency via Redis |
| Web Crawler | URL frontier queue; per-domain rate limiting; politeness |
| Search Autocomplete (Typeahead) | Trie vs inverted index; batch top-k counts; new trends surface in minutes |
| Notification System | 10M+ notifications/day; push + email + SMS; priority queues; DLQ for retries |
| Real-Time Leaderboard | Top 100 global in < 50ms; Redis sorted sets |
| Code / Text Sharing (Pastebin) | Object storage for content, relational DB for metadata; pastes up to 10MB |
| File Storage (Google Drive) | Metadata DB separate from blob store; block deduplication; multipart upload |
| Distributed Cache | Consistent hashing; hot key eviction; cache stampede prevention |
| Rate Limiter | No overselling; token bucket vs sliding window |
| Task Scheduler / Cron | Distributed lock on scheduler to prevent duplicate runs |
| Payment System | Idempotency keys; acquirer circuit breaker; settlement reconciliation |
| Open Canvas | Free-form — no constraints, blank canvas |

**Session features:**
- Timer (pause / resume / end)
- Problem tags and difficulty labels (`imd-tag`, `imd-problem-tags`)
- Diff dots showing what the reference solution covers vs what you drew (`imd-diff-dot`, `imd-diff-dots`)
- Detail panel with scenarios, stats, and time notes (`imd-detail-scenario`, `imd-detail-stats`)
- Filter chips for problem type (`imd-filter-chip--active`, `imd-duration-chip--active`)
- Load community designs as a starting point for any problem

### 2.8 Community Gallery

- Browse, fork, and star system design architectures from the community (`/community` route)
- Publish your own design: "Publish design" → visible in gallery
- Publishing requires login; MIT License
- Categories: Microservices, Real-time, ML/AI, Streaming, Fintech, Databases, CDN, Event-driven
- Fork count, star count, view count tracked (via Kafka consumers + Postgres)
- "No published designs yet. Be the first to publish!"

### 2.9 Share Links

- Short-lived canvas share URLs (`/files/shareLinks`) stored with a TTL in Redis
- Read-only embed mode (`/embed`)
- Real-time collaboration rooms (`/files/rooms`)

---

## 3. Stack Decisions

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind) | SSR for community gallery SEO; client-side canvas; App Router for layouts |
| Canvas | `@excalidraw/excalidraw` | Open-source, roughjs hand-drawn style, full API for programmatic element updates |
| Mermaid | `mermaid` v11 + `@excalidraw/mermaid-to-excalidraw` | Already bundled in source — parse Mermaid, render to Excalidraw elements |
| Backend | Go + Chi Router | 100k+ concurrent WebSocket connections; 5MB RAM per goroutine vs 50MB in Node |
| Database | PostgreSQL 16 | Primary store — designs, users, rooms. JSONB for Excalidraw elements |
| Query layer | sqlc | Type-safe SQL; no ORM; generated Go; matches ui-library pattern |
| Caching | Redis 7 | Sessions, share link TTL, WS pub/sub for multi-instance hub, rate limiting |
| Events | Kafka + Zookeeper | Async analytics (fork/star/view counts), room state persistence workers |
| Auth | Custom JWT (bcrypt + HS256) | httpOnly cookie or Bearer header; refresh token table in Postgres |
| Monorepo | Turborepo (npm workspaces) | Shared types, ordered pipeline: `generate → build → test` |
| Containers | Docker + Docker Compose | One-command local dev — 8 services with health checks |
| API codegen | swaggo → openapi.yaml → openapi-typescript → api.ts | TypeScript types always in sync with Go handlers |
| Payments | Stripe + PayPal | Stripe for cards; PayPal accepts credit/debit + PayPal balance worldwide |
| AI | OpenAI API (SSE proxy) | text-to-diagram streaming; diagram-to-code generation |

**Why separate Go backend instead of Next.js API routes:**

| Concern | Next.js API routes | Go backend |
|---|---|---|
| WebSocket (real-time collab) | Limited, restarts on deploy | Native goroutines, persistent hub |
| AI SSE streaming | Works but cold starts on Vercel | No cold starts, no timeout limits |
| 1000+ concurrent WS connections | Memory-heavy in Node | ~5MB RAM per goroutine |
| Simulation validation | Fine | Fast, no GC pauses |

**Simulation engine is client-side** — 60fps packet animation needs no backend round-trip.
Backend only handles: auth, community DB, share links, WebSocket hub, AI proxy.

---

## 4. Monorepo Structure

```
paperdraw/
├── apps/
│   ├── web/                    ← Next.js 14 frontend
│   └── api/                    ← Go REST + WebSocket backend
├── packages/
│   ├── types/                  ← @paperdraw/types (generated)
│   └── codegen/                ← openapi-typescript config
├── architecture/
│   ├── diagrams/               ← 7 Mermaid .mmd source files
│   ├── images/                 ← generated PNGs
│   └── README.md
├── folder-structure/
│   ├── diagrams/               ← 7 folder layout .mmd files
│   ├── why/                    ← 7 decision docs (one per layer)
│   ├── images/                 ← generated PNGs
│   └── README.md
├── scripts/
│   ├── codegen.sh              ← swaggo + sqlc + openapi-typescript
│   ├── migrate.sh              ← goose up/down/status/create/reset
│   ├── seed.sh                 ← seeds admin user + 10 preset templates
│   └── topics.sh               ← creates all Kafka topics
├── docker-compose.yml          ← 8 services, health-check driven startup
├── turbo.json
├── package.json                ← npm workspaces root
├── .env.example
└── DESIGN.md                   ← this file
```

---

## 5. Frontend Architecture

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← root layout, ThemeProvider, AuthProvider
│   │   ├── page.tsx                ← home → redirect to /canvas
│   │   ├── canvas/
│   │   │   └── page.tsx            ← main canvas page
│   │   ├── community/
│   │   │   ├── page.tsx            ← community gallery (SSR)
│   │   │   └── [id]/page.tsx       ← design detail + fork button
│   │   ├── interview/
│   │   │   └── page.tsx            ← interview mode
│   │   ├── plus/
│   │   │   └── page.tsx            ← Paperdraw+ pricing page (#pricing)
│   │   ├── embed/
│   │   │   └── page.tsx            ← read-only embed view
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── privacy/page.tsx
│   │   └── terms/page.tsx
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── ExcalidrawCanvas.tsx        ← Excalidraw wrapper
│   │   │   ├── ComponentPalette.tsx        ← 45+ component library sidebar
│   │   │   ├── ComponentPaletteItem.tsx    ← draggable component card
│   │   │   └── CanvasToolbar.tsx           ← top bar actions
│   │   ├── simulation/
│   │   │   ├── SimulationPanel.tsx         ← traffic multiplier, speed, run/stop
│   │   │   ├── PacketAnimation.tsx         ← 60fps packet flow overlay
│   │   │   ├── NodeMetrics.tsx             ← per-node RPS/latency/CPU/memory
│   │   │   └── BottleneckRanking.tsx       ← sorted bottleneck list
│   │   ├── chaos/
│   │   │   ├── ChaosPanel.tsx              ← 7 chaos type selector
│   │   │   ├── ChaosScenarioList.tsx       ← app-level sub-scenarios
│   │   │   └── ChaosTargetPicker.tsx       ← "Component selected — click to apply chaos"
│   │   ├── mermaid/
│   │   │   ├── MermaidEditor.tsx           ← code editor with syntax highlight
│   │   │   └── MermaidConverter.tsx        ← calls mermaid-to-excalidraw
│   │   ├── ai/
│   │   │   ├── AiDiagramPanel.tsx          ← text input + SSE stream handler
│   │   │   └── AiSuggestions.tsx           ← context-aware component suggestions
│   │   ├── interview/
│   │   │   ├── InterviewModal.tsx          ← imd-modal, imd-overlay
│   │   │   ├── ProblemList.tsx             ← imd-list, imd-problem-row
│   │   │   ├── ProblemDetail.tsx           ← imd-detail, imd-detail-scenario
│   │   │   ├── InterviewTimer.tsx          ← pause/resume/end
│   │   │   └── DiffDots.tsx               ← imd-diff-dot (your design vs reference)
│   │   ├── community/
│   │   │   ├── DesignCard.tsx
│   │   │   ├── DesignGallery.tsx
│   │   │   └── PublishModal.tsx
│   │   ├── share/
│   │   │   ├── ShareLinkButton.tsx
│   │   │   └── CollabButton.tsx            ← CollabButton-collaborators
│   │   └── ui/
│   │       ├── Toolbar.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
│   ├── hooks/
│   │   ├── useExcalidraw.ts            ← excalidrawAPI ref, updateScene
│   │   ├── useSimulation.ts            ← packet loop, metrics, bottleneck ranking
│   │   ├── useChaos.ts                 ← chaos injection state machine
│   │   ├── useCollaboration.ts         ← WebSocket connect/send/receive
│   │   ├── useMermaid.ts               ← parse + convert to elements
│   │   ├── useAiStream.ts              ← SSE fetch for text-to-diagram
│   │   └── useInterview.ts             ← timer, problem state, diff scoring
│   ├── lib/
│   │   ├── api.ts                      ← typed fetch client (@paperdraw/types)
│   │   ├── components-library.ts       ← 45+ component definitions + metadata
│   │   ├── simulation-engine.ts        ← packet routing, metric calculation
│   │   ├── chaos-scenarios.ts          ← all 7 types + 30+ sub-scenarios
│   │   └── interview-problems.ts       ← full problem bank with reference solutions
│   └── store/
│       ├── canvas.store.ts             ← Zustand: elements, appState, collaborators
│       ├── simulation.store.ts         ← Zustand: running, metrics, bottlenecks
│       └── auth.store.ts               ← Zustand: user, tokens
└── public/
```

---

## 6. Backend Architecture

```
apps/api/
├── cmd/
│   └── server/
│       └── main.go             ← entry point, chi router, signal handling
├── internal/
│   ├── config/
│   │   └── config.go           ← env var loading, validation
│   ├── middleware/
│   │   ├── auth.go             ← JWT verify, attach claims to ctx
│   │   ├── ratelimit.go        ← Redis token bucket
│   │   └── cors.go
│   ├── handlers/
│   │   ├── health.go           ← GET /health
│   │   ├── auth.go             ← POST /auth/register, /auth/login, /auth/refresh
│   │   ├── designs.go          ← GET/POST/PATCH/DELETE /designs, /designs/:id/fork, /designs/:id/star
│   │   ├── share.go            ← POST /share, GET /share/:slug
│   │   ├── ai.go               ← POST /v1/ai/text-to-diagram/chat-streaming (SSE)
│   │   │                          POST /v1/ai/diagram-to-code/generate
│   │   ├── community.go        ← GET /community (paginated)
│   │   └── broadcast.go        ← POST /api/broadcast
│   ├── realtime/
│   │   ├── hub.go              ← WebSocket hub, rooms map, broadcast loop
│   │   ├── client.go           ← per-connection read/write pumps
│   │   └── message.go          ← typed message structs
│   ├── services/
│   │   ├── auth.service.go     ← bcrypt, JWT sign/verify, refresh token rotation
│   │   ├── design.service.go   ← business logic: fork, star, publish validation
│   │   ├── share.service.go    ← slug generation, Redis TTL
│   │   └── ai.service.go       ← OpenAI SSE proxy
│   ├── db/
│   │   ├── db.go               ← pgxpool setup
│   │   └── migrations/
│   │       ├── 001_create_users.sql
│   │       ├── 002_create_designs.sql
│   │       ├── 003_create_share_links.sql
│   │       ├── 004_create_collab_rooms.sql
│   │       └── 005_create_event_log.sql
│   ├── sqlc/
│   │   ├── queries/            ← .sql query files (source of truth)
│   │   └── generated/          ← generated by sqlc — never edit
│   └── kafka/
│       ├── producer.go         ← publish events
│       └── workers/
│           ├── analytics.go    ← consume design.published/forked/viewed
│           ├── room.go         ← consume room.state_saved → persist to Postgres
│           └── notify.go       ← consume ai.diagram_generated
├── openapi/
│   └── openapi.yaml            ← generated by swaggo — never edit
├── Makefile                    ← swagger, sqlc, test, build targets
└── Dockerfile.dev              ← Air hot-reload
```

### API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness probe |
| `POST` | `/auth/register` | — | Create account (bcrypt) |
| `POST` | `/auth/login` | — | Returns access + refresh tokens |
| `POST` | `/auth/refresh` | cookie | Rotate refresh token |
| `GET` | `/auth/me` | JWT | Current user |
| `GET` | `/designs` | — | List community designs (paginated) |
| `GET` | `/designs/:id` | — | Get single design |
| `POST` | `/designs` | JWT | Publish design |
| `PATCH` | `/designs/:id` | JWT | Update own design |
| `DELETE` | `/designs/:id` | JWT | Delete own design |
| `POST` | `/designs/:id/fork` | JWT | Fork design (increments fork_count via Kafka) |
| `POST` | `/designs/:id/star` | JWT | Star/unstar design |
| `POST` | `/share` | JWT | Create share link (Redis TTL) |
| `GET` | `/share/:slug` | — | Resolve share link |
| `GET` | `/ws/room/:roomId` | JWT | WebSocket upgrade — collab room |
| `POST` | `/api/broadcast` | internal | Server-to-room broadcast |
| `POST` | `/v1/ai/text-to-diagram/chat-streaming` | JWT | SSE stream: text → diagram |
| `POST` | `/v1/ai/diagram-to-code/generate` | JWT | Diagram → infrastructure code |
| `POST` | `/webhooks/payment` | HMAC | Stripe / PayPal webhook |

---

## 7. Database Design

> All migrations in `apps/api/internal/db/migrations/` using goose (`-- +goose Up` / `-- +goose Down`)

### Tables

```sql
-- users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  twitter_handle TEXT,
  avatar_url    TEXT,
  tier          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'plus' | 'pro'
  stripe_customer_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- refresh_tokens
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- designs (community gallery)
CREATE TABLE designs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT,
  elements    JSONB NOT NULL DEFAULT '[]',    -- Excalidraw ExcalidrawElement[]
  app_state   JSONB NOT NULL DEFAULT '{}',    -- Excalidraw AppState
  tags        TEXT[] NOT NULL DEFAULT '{}',
  fork_count  INT NOT NULL DEFAULT 0,
  star_count  INT NOT NULL DEFAULT 0,
  view_count  INT NOT NULL DEFAULT 0,
  published   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX designs_published_idx ON designs(published, created_at DESC);
CREATE INDEX designs_elements_gin ON designs USING GIN(elements);

-- design_forks
CREATE TABLE design_forks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id UUID NOT NULL REFERENCES designs(id),
  fork_id     UUID NOT NULL REFERENCES designs(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- design_stars
CREATE TABLE design_stars (
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (design_id, user_id)
);

-- share_links (short TTL — Redis primary, Postgres for audit)
CREATE TABLE share_links (
  slug        TEXT PRIMARY KEY,
  design_id   UUID NOT NULL REFERENCES designs(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- collab_rooms
CREATE TABLE collab_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id  UUID REFERENCES designs(id),
  elements   JSONB NOT NULL DEFAULT '[]',
  app_state  JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- event_log (Kafka consumer idempotency)
CREATE TABLE event_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic        TEXT NOT NULL,
  kafka_offset BIGINT NOT NULL,
  partition    INT NOT NULL,
  payload      JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic, partition, kafka_offset)
);
```

### Key decisions

**JSONB for canvas elements** — Excalidraw elements are a JSON array. JSONB gives GIN indexes, no schema migrations when Excalidraw adds new element fields, and direct patch operations.

**UUID PKs** — `gen_random_uuid()` on all tables. No sequential ID leakage. Safe to generate client-side before insert.

**Tier column on users** — `free | plus | pro` driven by Stripe webhook. Rate-limit middleware checks this column.

**Event log** — every Kafka consumer writes `(topic, partition, offset)` before processing. Guarantees idempotency: if a worker crashes and replays, it sees the row and skips.

---

## 8. Kafka Topics

| Topic | Partitions | Retention | Published by | Consumed by |
|---|---|---|---|---|
| `design.published` | 3 | 7 days | `designs.go` handler | `analytics_worker` — init fork/star/view counters |
| `design.forked` | 3 | 7 days | `designs.go` fork handler | `analytics_worker` — increment fork_count |
| `design.viewed` | 2 | 1 day | `share.go` handler | `analytics_worker` — increment view_count |
| `ai.diagram_generated` | 1 | 3 days | `ai.go` handler | `notify_worker` — log AI usage, enforce free-tier quota |
| `room.state_saved` | 3 | 1 day | `realtime/hub.go` (every 30s) | `room_worker` — persist canvas snapshot to Postgres |

**Why Kafka here:**
Without it, every handler writes analytics synchronously — latency added to every user request.
With it, the handler fires an event and returns. Workers process async without the user waiting.

Topic creation is automatic via the `kafka-setup` Docker service. Manual: `./scripts/topics.sh`

---

## 9. Real-time Collaboration

> Full flow: `folder-structure/diagrams/06-realtime-collab.mmd`

```
Browser A edits an element
  ↓  (useCollaboration.ts)
WebSocket send: { type: "element_update", payload: ExcalidrawElement[] }
  ↓
Go Hub.go — receives from Client A
  ↓
Hub broadcasts to all other clients in the same room
  ↓  (Redis pub/sub for multi-instance scale)
Browser B receives update
  ↓  (useCollaboration.ts)
excalidrawAPI.updateScene({ elements })   ← canvas updates instantly
```

### WebSocket message types

| Type | Payload | When |
|---|---|---|
| `element_update` | `ExcalidrawElement[]` | User draws, moves, or edits anything |
| `cursor_move` | `{userId, x, y, color}` | Mouse moves |
| `user_join` | `{userId, displayName, color}` | New connection to room |
| `user_leave` | `{userId}` | Disconnect |
| `full_state` | `{elements, appState}` | Sent to new joiner on connect |

### Room persistence flow

State is ephemeral in memory. Every 30 seconds the hub publishes a `room.state_saved` event.
The `room_worker` Kafka consumer writes the snapshot to `collab_rooms.elements` in Postgres.
A new user who joins receives the last Postgres snapshot as `full_state`, then live `element_update` events.

### Paperdraw+ gate

Real-time collaboration is a **Paperdraw+ feature**. Free users see the `CollabButton` but are shown
the upgrade modal on click. The `tier` field on the JWT claims is checked by the `/ws/room/:roomId` handler.

---

## 10. Codegen Pipeline

```
Go handler (swaggo annotations)
    ↓  make swagger
apps/api/openapi/openapi.yaml
    ↓  npm run generate (packages/codegen)
packages/types/generated/api.ts
    ↓  @paperdraw/types
apps/web  ← TypeScript knows every request/response shape
```

Also:

```
apps/api/sqlc/queries/*.sql
    ↓  sqlc generate
apps/api/sqlc/generated/*.sql.go   ← type-safe Go DB functions
```

### CI drift check

`codegen.sh` runs in CI with `CI=true`. If any generated file differs after running codegen,
CI fails with the list of drifted files. Developers must commit updated generated files.

### Rule: never edit generated files

- `apps/api/sqlc/generated/` — overwritten by `sqlc generate`
- `apps/api/openapi/openapi.yaml` — overwritten by `swaggo`
- `packages/types/generated/api.ts` — overwritten by `openapi-typescript`

Fix the source (Go annotations / SQL queries) and re-run codegen.

```bash
./scripts/codegen.sh          # full pipeline

# Individual steps:
cd apps/api && make swagger   # → openapi.yaml
cd apps/api && make sqlc      # → sqlc/generated/
npm run generate -w packages/codegen  # → packages/types/generated/api.ts
```

---

## 11. AI Features

### Text-to-Diagram (SSE streaming)

```
POST /v1/ai/text-to-diagram/chat-streaming
Content-Type: application/json
Authorization: Bearer <token>

{ "prompt": "Design a Twitter-scale feed with 100M users" }

→ Response: text/event-stream
data: {"type":"chunk","delta":"...mermaid syntax..."}
data: {"type":"done","elements":[...ExcalidrawElement...]}
```

Flow:
1. Go handler proxies to OpenAI chat completion API with SSE enabled
2. As tokens stream in, it parses Mermaid syntax chunks
3. On `done`, converts Mermaid → Excalidraw elements via the same `mermaid-to-excalidraw` library
4. Frontend `useAiStream.ts` accumulates chunks, calls `excalidrawAPI.updateScene` on completion

### Diagram-to-Code

```
POST /v1/ai/diagram-to-code/generate
{ "elements": [...ExcalidrawElement...] }

→ { "code": "terraform { ... }" }
```

Converts the current canvas into infrastructure code (Terraform / Docker Compose / K8s YAML).

### Free-tier quota

Tracked in Redis with a daily counter per `userId`. When the limit is hit:
> "You've hit your AI limit on the free plan. Try Paperdraw+ for more or come back tomorrow."

Paperdraw+ users bypass the Redis quota check.

### Context-aware suggestions (client-side)

Based on which components are on the canvas, `AiSuggestions.tsx` surfaces:
- "Add circuit breaker" — when a service calls another without one
- "Add Load Balancer" — when a service is directly hit from the internet
- "Add read replica" — when a single DB handles all queries
- "Add cache OR parallelize calls OR shorten chain via async" — when deep call chain detected
- "Add fallback to origin OR add cache replica for failover" — on CDN-only paths

---

## 12. Pricing Tiers

| Feature | Free | Paperdraw+ |
|---|---|---|
| Unlimited diagramming | ✓ | ✓ |
| Component library (45+) | ✓ | ✓ |
| Starter simulations | ✓ | ✓ |
| **Unlimited simulation runs** | ✗ | ✓ |
| **All 7 chaos types** | limited | ✓ |
| **AI text-to-diagram** | daily limit | unlimited |
| **AI diagram-to-code** | ✗ | ✓ |
| **Real-time collaboration** | ✗ | ✓ |
| **Team workspace** | ✗ | ✓ |
| **Export to Paperdraw+ / Excalidraw format** | ✗ | ✓ |
| **Create presentations** | ✗ | ✓ |
| **Comments** | ✗ | ✓ |
| Community gallery (browse + fork) | ✓ | ✓ |
| Publish designs | ✓ | ✓ |
| Interview mode | ✓ | ✓ |

**Trial:** "Try free for 14 days · no credit card"
**Billing:** Stripe (cards) + PayPal (credit/debit + balance worldwide), monthly
**Webhook:** `POST /webhooks/payment` — HMAC verified, updates `users.tier` in Postgres

---

## 13. Docker Setup

| Service | Image | Port | Purpose |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | Primary datastore |
| `redis` | `redis:7-alpine` | 6379 | Cache + sessions + WS pub/sub |
| `zookeeper` | `confluentinc/cp-zookeeper:7.6.0` | 2181 | Kafka coordinator |
| `kafka` | `confluentinc/cp-kafka:7.6.0` | 9092 / 29092 | Event streaming |
| `kafka-setup` | `confluentinc/cp-kafka:7.6.0` | — | Creates topics then exits |
| `migrate` | `migrate/migrate:v4.17.0` | — | Runs goose migrations then exits |
| `api` | `apps/api/Dockerfile.dev` | 8080 | Go API with Air hot-reload |
| `web` | `apps/web/Dockerfile.dev` | 3000 | Next.js with volume mount |

**Startup order (health-check driven):**
```
db (healthy) ──────────────────────────────────────┐
redis (healthy) ───────────────────────────────────┤ → api (starts)
kafka (healthy) → kafka-setup (exits) ─────────────┘
db (healthy) → migrate (exits)

api (running) → web (starts)
```

**Named volumes:** `postgres_data`, `kafka_data`, `redis_data`

```bash
cp .env.example .env    # set JWT_SECRET + OPENAI_API_KEY
docker compose up
```

---

## 14. Environment Variables

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | Go API | `postgres://user:pass@db:5432/paperdraw` |
| `REDIS_URL` | Go API | `redis://redis:6379` |
| `KAFKA_BROKERS` | Go API | `kafka:9092` |
| `JWT_SECRET` | Go API | HS256 signing key — min 32 chars |
| `JWT_ACCESS_TTL` | Go API | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_TTL` | Go API | Refresh token TTL (e.g. `7d`) |
| `OPENAI_API_KEY` | Go API | AI text-to-diagram (required for AI features) |
| `STRIPE_SECRET_KEY` | Go API | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Go API | Stripe webhook HMAC verification |
| `PAYPAL_CLIENT_ID` | Go API | PayPal SDK |
| `PAYPAL_CLIENT_SECRET` | Go API | PayPal API |
| `PORT` | Go API | HTTP server port (default `8080`) |
| `ENVIRONMENT` | Go API | `development` or `production` |
| `CORS_ORIGINS` | Go API | `http://localhost:3000` in dev |
| `NEXT_PUBLIC_API_URL` | Next.js | `http://localhost:8080` in dev |
| `NEXT_PUBLIC_WS_URL` | Next.js | `ws://localhost:8080` in dev |
| `NEXT_PUBLIC_PAPERDRAW_PLUS_URL` | Next.js | `/plus` |

---

## 15. Key Commands

```bash
# Start everything
cp .env.example .env
docker compose up

# Codegen (run after changing Go handlers or SQL)
./scripts/codegen.sh

# Migrations
./scripts/migrate.sh            # run pending
./scripts/migrate.sh status     # show status
./scripts/migrate.sh down       # roll back last
./scripts/migrate.sh create add_indexes  # new migration file

# Seed
./scripts/seed.sh               # admin user + 10 preset templates

# Kafka topics (auto-created by kafka-setup container)
./scripts/topics.sh             # manual fallback

# Individual codegen steps
cd apps/api && make swagger     # → openapi.yaml
cd apps/api && make sqlc        # → sqlc/generated/
npm run generate -w packages/codegen  # → packages/types/generated/api.ts

# Tests
turbo run test
cd apps/api && go test ./...
cd apps/web && npx vitest run

# Type check
turbo run typecheck

# Generate diagram PNGs
cd architecture && for f in diagrams/*.mmd; do
  mmdc -i "$f" -o "images/$(basename $f .mmd).png"
done
cd ../folder-structure && for f in diagrams/*.mmd; do
  mmdc -i "$f" -o "images/$(basename $f .mmd).png"
done
```

---

## 16. Build Order (Phases)

| Phase | What to build | Done when |
|---|---|---|
| **1** | Monorepo scaffold · docker-compose up · all 8 services healthy | `docker compose up` shows all green |
| **2** | Go API skeleton · config · health endpoint · chi router · Air | `GET /health` → 200 |
| **3** | PostgreSQL migrations · sqlc queries · codegen pipeline | `@paperdraw/types` has all types |
| **4** | Auth endpoints (register/login/refresh/me) · JWT · bcrypt | Login returns tokens |
| **5** | Designs CRUD · fork · star · publish · Kafka producers | Community API live |
| **6** | Share links (slug + Redis TTL) | Short URLs resolve |
| **7** | Next.js scaffold · typed API client · auth pages (login/signup) | Auth flow working in browser |
| **8** | Excalidraw canvas · component palette (45+ components) · toolbar | Canvas renders, components draggable |
| **9** | Simulation engine · packet animation · per-node metrics · bottleneck ranking | Live simulation at 60fps |
| **10** | Chaos panel · 7 types · 30+ app-level sub-scenarios | Chaos injects + surfaces metrics |
| **11** | Mermaid editor · mermaid-to-excalidraw conversion | Paste Mermaid → diagram on canvas |
| **12** | AI text-to-diagram (SSE proxy → OpenAI) · free-tier quota | Prompt → diagram streams in |
| **13** | AI diagram-to-code · context-aware suggestions | Suggestions appear on canvas |
| **14** | Community gallery (SSR) · design detail · fork | Gallery page live |
| **15** | WebSocket hub · real-time collaboration · cursor sync | Two browsers sync |
| **16** | Interview mode · timer · problem bank · diff dots | Full interview flow |
| **17** | Paperdraw+ pricing page · Stripe + PayPal webhooks · tier gating | Payment flow end-to-end |
| **18** | GitHub Actions CI (lint + test + codegen drift check) | PRs gated |
| **19** | Deploy to Railway / Fly.io | Live on the internet |

---

*Generated from `/Users/sandeepv/Desktop/paperdraw/index.js` source analysis + paperdraw.dev*
