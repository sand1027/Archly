# Archly CLI

Headless, scriptable client for the [Archly](https://github.com/archly) API.

Generate Mermaid architecture diagrams or database ERDs, save sessions, and export infra code from the terminal.

## Install

**One command** (downloads release binary, or falls back to `go install`):

```bash
curl -fsSL https://raw.githubusercontent.com/sand1027/Archly/main/archly-cli/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
archly version
```

**Homebrew** (macOS / Linux):

```bash
# Short path (after you publish github.com/sand1027/homebrew-tap — see homebrew-tap/README.md)
brew tap sand1027/tap
brew install archly

# Or directly from this repo (works today)
brew install sand1027/archly/archly --HEAD
```

After the first release (`v0.1.0`) and running `scripts/bump-brew-formula.sh`:

```bash
brew install sand1027/archly/archly   # stable binary, no Go required
```

**With Go installed:**

```bash
go install github.com/sand1027/Archly/archly-cli@latest
```

**From a clone:**

```bash
cd archly-cli && make install
# or: go build -o archly .
```

## Quick start

```bash
export ARCHLY_API_URL=http://localhost:8080   # or your deployed API

archly doctor
archly login                                    # prompts for email/password

# Architecture diagram (flowchart)
archly generate "Design a Twitter-scale feed architecture" -o feed.mmd

# Database ERD (erDiagram, 30–40 tables)
archly generate --mode schema "PostgreSQL e-commerce with 35 tables" -o shop.mmd

# Pin a provider (matches web ModelSelect)
archly generate -p ollama "Design Stripe-scale payments" -o payments.mmd
archly generate -p nvidia --mode schema "SaaS multi-tenant ERD" -o saas.mmd

# Export infra code (uses diagram-to-code shim until B1 ships)
archly export -f feed.mmd --format docker-compose -o compose.yml

# Save / list sessions (requires login)
archly session save -t "Feed v1" -f feed.mmd
archly session list
archly session get <id> -o restored.mmd
```

## Config

| Location | Purpose |
|----------|---------|
| `~/.archly/config.yaml` | API URL, default provider, default mode |
| `~/.archly/credentials` | JWT tokens (mode `0600`) |

Example `~/.archly/config.yaml`:

```yaml
api_url: http://localhost:8080
app_url: http://localhost:3000
default_provider: ollama
default_mode: architecture   # or schema
```

### Environment

| Variable | Purpose |
|----------|---------|
| `ARCHLY_API_URL` | API base URL |
| `ARCHLY_APP_URL` | Web app URL (Phase 2 `open`) |
| `ARCHLY_TOKEN` | JWT for CI (skips credentials file) |
| `ARCHLY_PROVIDER` | Default AI provider |
| `ARCHLY_MODE` | Default generate mode |
| `ARCHLY_EMAIL` / `ARCHLY_PASSWORD` | Non-interactive login |

## Commands (Phase 1)

| Command | Description |
|---------|-------------|
| `archly version` | CLI version |
| `archly doctor` | API health + auth check |
| `archly login` | Authenticate |
| `archly logout` | Clear credentials |
| `archly whoami` | Current user |
| `archly generate` | SSE text → Mermaid |
| `archly export` | Mermaid → Terraform / Compose / K8s |
| `archly session list\|get\|save\|delete` | Saved designs |

### Generate flags

```
-f, --file       Prompt file
-o, --out        Output .mmd file
-p, --provider   ollama|groq|github|openrouter|nvidia|nvidia-nemotron|nvidia-deepseek
    --mode       architecture (default) | schema
    --no-stream  Buffer then print
    --strict     Exit 3 on partial diagrams
    --json       JSON output
    --quiet      No stderr status
```

### Providers

- Empty / omitted → **auto** chain (same as web): Ollama → Groq → NVIDIA → GitHub → OpenRouter
- Pinned provider → **fail hard** if unavailable (no silent fallback)

## Session storage (CLI shim)

Until `kind: mermaid` lands on the backend (cliplan B2), the CLI saves:

- `kind`: `flow` (architecture) or `schema` (erDiagram)
- `elements`: `{ "nodes": [], "edges": [] }`
- `app_state.mermaid`: raw Mermaid source

Web-opened sessions without `app_state.mermaid` cannot be exported via `session get`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Usage / validation error |
| 2 | API / auth / network error |
| 3 | Partial stream (`--strict`) |

## Plan & roadmap

See [`../cliplan.md`](../cliplan.md) for Phase 2 (`chat`, `share`, `community`) and backend gaps (B1 mermaid-to-code, B4 providers endpoint).
