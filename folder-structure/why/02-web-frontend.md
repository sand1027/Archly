# Why: apps/web Frontend Structure

## Overview
`apps/web` is a Next.js 14 App Router application. The canvas and simulation engine run entirely
client-side (no server round-trips needed for 60fps animation). The backend is only called for
persisting designs, auth, share links, and real-time collaboration.

## Key architectural decision: client-side simulation
The simulation engine and chaos injection logic live in the browser. This is intentional:
- Packet animation requires `requestAnimationFrame` — server cannot do this
- Simulation state changes 60 times per second — network latency would make it unusable
- Each user's simulation is independent — no shared state needed for single-player mode

## Folder breakdown

| Folder / File | Why it exists |
|---|---|
| `app/(canvas)/page.tsx` | Main canvas page — grouped with `(canvas)` route group so it gets its own layout without showing in URL |
| `app/community/` | Community gallery — server-side rendered list of public designs |
| `app/interview/` | Interview mode — client-side only, no backend needed for timers and problem display |
| `app/share/[id]/` | Shared canvas — fetches read-only snapshot from backend via share ID |
| `components/canvas/` | Excalidraw wrapper + all canvas UI chrome (toolbar, sidebar, simulation bar) |
| `components/simulation/` | Packet animation, metrics display, chaos panel — all browser-side |
| `components/mermaid/` | Mermaid code editor + the converter that turns mermaid → Excalidraw elements |
| `components/community/` | Design cards and gallery grid used on the community page |
| `components/ui/` | Base primitives (button, input, card) — unstyled or shadcn/ui based |
| `hooks/` | Each hook owns one domain — fetching, WebSocket, auth. No logic in components. |
| `lib/api/client.ts` | Single typed fetch wrapper — all API calls go through here, reads `NEXT_PUBLIC_API_URL` |
| `lib/api/ws-client.ts` | WebSocket client wrapper — connects to Go WebSocket hub, handles reconnect |
| `lib/simulation/engine.ts` | Core simulation loop — reads canvas elements, spawns packets, calculates metrics |
| `lib/simulation/chaos.ts` | 7 chaos type implementations — crash, slow, surge, partition, throttle, canary, zero-weight |
| `lib/components-registry.ts` | The 45+ system design component definitions (icon, color, category, metadata) |
| `lib/mermaid-to-canvas.ts` | Wraps `@excalidraw/mermaid-to-excalidraw` — called when user pastes Mermaid code |
| `lib/presets.ts` | 10 pre-built architecture templates stored as Excalidraw element JSON |
| `store/canvas.store.ts` | Zustand — Excalidraw elements + appState (source of truth for the canvas) |
| `store/simulation.store.ts` | Zustand — running packets, per-node metrics, active chaos injections |
| `store/auth.store.ts` | Zustand — current user, JWT, isPro flag. Persisted to localStorage. |
| `providers/` | React context wrappers — wrap the root layout so every page has access |
| `types/` | Local manual types + re-exports from `@paperdraw/types` (generated) |
