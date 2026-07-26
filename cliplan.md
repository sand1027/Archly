# Archly CLI Plan

Planning doc for a first-party CLI that talks to the existing Archly API.  
**Status:** draft · **Not implemented yet** · Iterate here before writing code.

---

## 1. Why a CLI

The browser app is the visual studio (Flow / Canvas / sim). A CLI should be the **headless, scriptable surface** for the same core loop:

> natural language → Mermaid architecture → save / share / infra code

That unlocks:

- Pipelines and CI (generate, lint, export Compose/K8s)
- Local + Ollama workflows without opening the UI
- Agents / scripts that treat Archly as a tool
- Faster iteration for power users (`generate | export`)

**Non-goal for v1:** editing Excalidraw or React Flow graphs in the terminal. Mermaid is the interchange format.

---

## 2. Product principles

| Principle | Meaning |
|-----------|---------|
| Mermaid-first | `.mmd` in and out; JSON only when talking to `/designs` |
| Thin client | Reuse existing HTTP/SSE APIs; no duplicate AI logic in the CLI |
| Unix-friendly | stdout/stderr, exit codes, pipes, `--json` for machines |
| Config over flags | `~/.archly/config.yaml` for API URL, provider, tokens; flags override |
| Same auth as web | JWT access (+ refresh later); never print tokens in normal output |
| Fail loud | Clear errors for quota, Ollama down, bad Mermaid, 401 |

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  archly (CLI binary)                                        │
│                                                             │
│  cmd/          Cobra commands (login, generate, …)          │
│  internal/                                                  │
│    config/     ~/.archly/config.yaml + env                  │
│    api/        HTTP + SSE client (mirrors frontend client)  │
│    mermaid/    local validate / normalize / lint            │
│    output/     pretty / json / quiet                        │
│    auth/       token store (file, 0600)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS + SSE
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Archly API (existing)                                      │
│  /auth/*  /designs/*  /share/*  /v1/ai/*  /health           │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Ollama       Groq / GH     OpenRouter
     (local)        Models        (fallback)
```

### Placement in the monorepo

```
Archly/
├── archly-backend/          # existing Go API
├── archly-frontend/         # existing Next.js app
├── archly-cli/              # NEW — Go module
│   ├── go.mod
│   ├── main.go
│   ├── cmd/                 # Cobra root + subcommands
│   ├── internal/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── mermaid/
│   │   └── output/
│   └── README.md
└── cliplan.md               # this file
```

**Why Go:** same language as `archly-backend`, single static binary, easy `go install` / GitHub Releases, good SSE streaming support.

**Alternative considered:** Node/TS sharing frontend types — rejected for v1 (heavier runtime, weaker “install one binary” story). Revisit if we publish a JS SDK later.

---

## 4. Config & environment

### File: `~/.archly/config.yaml`

```yaml
api_url: http://localhost:8080          # or https://api.example.com
app_url: http://localhost:3000          # for `archly open`
default_provider: groq                  # "" | ollama | groq | github | openrouter
default_format: mermaid                 # for generate output
```

### Secrets: `~/.archly/credentials` (mode `0600`)

```yaml
access_token: eyJ...
# refresh_token: ...   # when backend exposes it cleanly to CLI
expires_at: 2026-07-26T18:00:00Z
```

### Env overrides (highest priority)

| Env | Purpose |
|-----|---------|
| `ARCHLY_API_URL` | API base |
| `ARCHLY_APP_URL` | Web app base (`open`) |
| `ARCHLY_TOKEN` | Bypass stored JWT (CI) |
| `ARCHLY_PROVIDER` | Default AI provider |
| `ARCHLY_CONFIG` | Alternate config path |

Flags always win over env over file.

---

## 5. Mapping to existing APIs

Ground truth today (frontend `endpoints.ts` + backend):

| CLI concern | API |
|-------------|-----|
| Health | `GET /health` |
| Register / login / me | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Refresh | `POST /auth/refresh` |
| List / get / save / update / delete designs | `/designs`, `/designs/mine`, `/designs/{id}` |
| Fork / star | `POST /designs/{id}/fork`, `…/star` |
| Share create / resolve | `POST /share`, `GET /share/{slug}` |
| Text → Mermaid (SSE) | `POST /v1/ai/text-to-diagram/chat-streaming` |
| Diagram chat (SSE) | `POST /v1/ai/canvas-chat` |
| Diagram → infra | `POST /v1/ai/diagram-to-code/generate` |

**Gaps to note (plan around them, don’t block MVP):**

1. **diagram-to-code** currently takes Excalidraw-style `elements[]`. CLI should either:
   - send Mermaid wrapped in a minimal payload the API already accepts, **or**
   - add a small backend endpoint `POST /v1/ai/mermaid-to-code` that accepts `{ mermaid, format }` (preferred for clean CLI).
2. **Saving from Mermaid alone** — designs expect `kind` + `elements` (canvas or `{nodes,edges}`). Options:
   - Store Mermaid in `app_state.mermaid` / `elements` as a string blob with `kind: "flow"` placeholder, **or**
   - Add `kind: "mermaid"` on the backend (cleanest long-term).
3. Simulation / chaos stay **web-only** unless we later port heuristics server-side.

Document any backend additions in §10.

---

## 6. Command surface

### 6.1 MVP (Phase 1) — ship this first

```
archly version
archly doctor                         # API health + auth + provider hint
archly login [--email] [--password]   # interactive prompt if missing
archly logout
archly whoami

archly generate <prompt...>           # SSE → Mermaid on stdout
  -f, --file prompt.txt
  -o, --out design.mmd
  -p, --provider ollama|groq|github|openrouter
  --no-stream                         # buffer then print (if API supports; else client-buffer)
  --json                              # { "mermaid": "...", "provider": "..." }

archly session list
archly session get <id> [-o file]
archly session save -t "Title" -f design.mmd
archly session delete <id>

archly export -f design.mmd --format terraform|docker-compose|kubernetes [-o out]
```

**Happy path demo:**

```bash
archly login
archly generate "Design Unacademy production architecture" -o unacademy.mmd
archly export -f unacademy.mmd --format docker-compose -o compose.yml
archly session save -t "Unacademy" -f unacademy.mmd
```

### 6.2 Phase 2 — share, community, chat

```
archly chat -f design.mmd "Where are the bottlenecks?"
archly share create <design-id> [--ttl 72]
archly share get <slug>
archly community list [--q] [--tag]
archly community fork <id>
archly community star <id>
archly open -f design.mmd             # upload/save + open APP_URL/canvas?...
```

### 6.3 Phase 3 — local intelligence & DX

```
archly lint -f design.mmd             # parse + heuristics (orphan nodes, no DB, etc.)
archly diff a.mmd b.mmd               # added/removed nodes & edges
archly init <template>                # twitter-feed | streaming | payments | …
archly provider list
archly provider set ollama
archly generate --watch prompt.md     # regen on file change
```

### 6.4 Explicitly out of scope (for now)

- Interactive TUI graph editor
- WebSocket collab rooms
- Running traffic / packet simulation in CLI
- Payment / Plus webhooks

---

## 7. UX details

### Streaming

- Default: print Mermaid tokens to **stdout** as they arrive (same SSE as the web AI panel).
- Progress / status on **stderr** (`provider=ollama model=archly-architect`).
- On `[DONE]`, exit `0`. On network cut with partial Mermaid that still starts with `flowchart`, exit `0` with a stderr warning (match web salvage behavior) **or** exit `2` with `--strict`.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Usage / local validation error |
| 2 | API / auth / quota / network |
| 3 | Partial stream / incomplete diagram (`--strict`) |

### Output modes

- Default: human-readable tables for `session list`, raw Mermaid/code for generate/export
- `--json`: machine-readable for every command
- `-q, --quiet`: no stderr chatter

### Provider pin

Same as web: empty = auto chain (Ollama → Groq → GitHub → OpenRouter).  
Pinned provider should **fail clearly** if misconfigured (don’t silently fall through for Ollama — match backend rules).

---

## 8. Internal package design (`archly-cli`)

```
cmd/
  root.go           # archly
  version.go
  doctor.go
  login.go
  logout.go
  whoami.go
  generate.go
  export.go
  session.go        # list|get|save|delete
  chat.go           # phase 2
  share.go
  community.go
  open.go
  lint.go           # phase 3
  diff.go
  init.go
  provider.go

internal/config/
  config.go         # load yaml + env + flags

internal/auth/
  store.go          # credentials file
  login.go

internal/api/
  client.go         # Do(), auth header, refresh-once
  sse.go            # parse data: lines, [DONE], errors
  auth.go
  designs.go
  share.go
  ai.go             # TextToDiagramStream, CanvasChat, DiagramToCode

internal/mermaid/
  validate.go       # must start with flowchart/graph, balanced shapes
  normalize.go      # optional: strip fences, subgraphs (align with web sanitize)
  lint.go           # heuristics
  diff.go

internal/output/
  print.go          # color optional, json encoder
```

### SSE client contract

Reuse the same wire format as the frontend:

```
data: <token>
data: <token>
data: [DONE]
```

Accumulate tokens; on non-2xx or `event: error`, surface the message body.

---

## 9. Install & distribution

| Method | Command / artifact |
|--------|--------------------|
| Dev | `cd archly-cli && go run . generate "..."` |
| Local install | `go install ./...` from `archly-cli` |
| Releases | GitHub Actions → `archly_{os}_{arch}.tar.gz` (darwin/linux/windows, amd64/arm64) |
| Homebrew (later) | `brew install archlyai/tap/archly` |
| Docker (optional) | `docker run --rm -v $PWD:/work archly/cli generate …` |

Version: embed via `-ldflags "-X main.version=…"` from git tag.

---

## 10. Backend / product changes (track here)

Small API tweaks that make the CLI clean. Prioritize only what’s needed per phase.

| ID | Change | Phase | Notes |
|----|--------|-------|-------|
| B1 | `POST /v1/ai/mermaid-to-code` `{ mermaid, format }` | 1 | Avoid fake Excalidraw elements from CLI |
| B2 | Design `kind: "mermaid"` or store Mermaid in `app_state` | 1 | So `session save -f x.mmd` is honest |
| B3 | Document OpenAPI for AI + designs | 2 | Optional codegen for clients |
| B4 | `GET /v1/ai/providers` — what’s configured | 2 | Powers `doctor` / `provider list` |
| B5 | Interview API for `archly interview` | 3 | Nice-to-have |

Until B1 ships, Phase 1 `export` can call diagram-to-code with a documented shim **or** ship `export` only after B1.

---

## 11. Security

- Credentials file `0600`; never log tokens
- `ARCHLY_TOKEN` for CI; document rotation
- TLS verify on by default; `--insecure` only for local self-signed
- Do not accept passwords on argv in docs examples when avoidable (prefer prompt / env `ARCHLY_PASSWORD` for automation)

---

## 12. Testing strategy

| Layer | What |
|-------|------|
| Unit | Mermaid validate/lint/diff; config merge; SSE parser |
| Integration | `httptest` against recorded fixtures for generate/export |
| Smoke | `archly doctor` against docker-compose stack in CI |
| Manual | Script in `archly-cli/scripts/smoke.sh` |

---

## 13. Phased delivery checklist

### Phase 1 — MVP (target: usable in a week of focused work)

- [ ] Scaffold `archly-cli` Go module + Cobra root
- [ ] Config + credentials store
- [ ] `login` / `logout` / `whoami` / `doctor` / `version`
- [ ] `generate` with SSE streaming + `-o` / `--provider`
- [ ] Decide B1 vs shim for `export`; implement `export`
- [ ] `session list|get|save|delete` with Mermaid storage strategy (B2)
- [ ] README with install + 5-command quickstart
- [ ] Update root README with “CLI (experimental)” link to this plan + cli README

### Phase 2

- [ ] `chat`, `share`, `community`, `open`
- [ ] `--json` everywhere
- [ ] Refresh-token handling
- [ ] B3 / B4 if useful

### Phase 3

- [ ] `lint`, `diff`, `init`, `provider`, `--watch`
- [ ] GitHub Releases + Homebrew
- [ ] Optional interview command

---

## 14. Example workflows (north-star)

**Local Ollama architect**

```bash
export ARCHLY_API_URL=http://localhost:8080
export ARCHLY_PROVIDER=ollama
archly generate "Design Stripe-scale payments" -o payments.mmd
archly lint -f payments.mmd
```

**CI: regenerate compose from prompt**

```bash
archly generate -f .archly/prompt.txt -o architecture.mmd --provider groq
archly export -f architecture.mmd --format docker-compose -o deploy/compose.generated.yml
```

**Pipe**

```bash
archly generate "IoT smart city pipeline" | tee iot.mmd | archly export --format kubernetes -o k8s/
```

*(Pipe into `export` needs `export` reading stdin when `-f` omitted — specify in Phase 1 UX.)*

**Open in studio**

```bash
archly open -f payments.mmd
# → saves session, prints URL, opens browser
```

---

## 15. Open decisions (resolve before coding)

| # | Question | Options | Lean |
|---|----------|---------|------|
| D1 | Repo layout | `archly-cli/` vs `cmd/archly` inside backend | **`archly-cli/`** separate module |
| D2 | Export without B1 | Shim elements vs wait for B1 | Prefer **B1 first** (small handler) |
| D3 | Session save format | `kind: mermaid` vs stash in flow `app_state` | Prefer **`kind: "mermaid"`** if cheap |
| D4 | Binary name | `archly` vs `archlyctl` | **`archly`** |
| D5 | Color / TUI | plain vs lipgloss | Plain first; color optional later |

Update this table when decisions are made.

---

## 16. Next step

When ready to implement:

1. Lock D1–D5 above.
2. Implement Phase 1 checklist in order (scaffold → auth → generate → export/session).
3. Keep this file as the living plan; move completed items to checked and note API PRs under §10.

---

*Last updated: 2026-07-26*
