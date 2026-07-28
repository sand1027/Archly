# Archly

Browser-based system design tool. Draw architecture diagrams on an Excalidraw canvas, generate diagrams from text using AI, run traffic simulations, collaborate in real-time, and export to Terraform / Docker Compose / Kubernetes.

**Stack:** Next.js 14 · Go + Chi · PostgreSQL · Redis · Kafka · Docker

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | 4.x+ | https://docs.docker.com/get-docker |
| Docker Compose | v2 (bundled) | included with Docker Desktop |
| Go | 1.21+ | https://go.dev/dl (only needed for local backend dev) |
| Node.js | 20+ | https://nodejs.org (only needed for local frontend dev) |

---

## Quick Start (Docker — recommended)

This runs the full stack (Postgres, Redis, Kafka, API, Frontend) in one command.

### 1. Clone the repo

```bash
git clone <your-repo-url> archly
cd archly
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```bash
# Required — generate with: openssl rand -hex 32
JWT_SECRET=your-minimum-32-char-secret-here

# Optional — AI diagram generation (at least one recommended)
GEMINI_API_KEY=        # https://aistudio.google.com/apikey
OPENROUTER_API_KEY=    # https://openrouter.ai/settings/keys
```

Everything else in `.env` works out of the box for local development.

### 3. Start all services

```bash
docker compose up -d
```

First run takes 3-5 minutes — it pulls images and builds the Go and Next.js containers.

### 4. Open the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8080 |
| API health check | http://localhost:8080/health |

### 5. Stop everything

```bash
docker compose down
```

To also delete all data (Postgres, Redis, Kafka volumes):

```bash
docker compose down -v
```

---

## CLI (experimental)

Headless client for generate / export / session management against the same API:

```bash
curl -fsSL https://raw.githubusercontent.com/sand1027/Archly/main/archly-cli/install.sh | bash
# or: brew install sand1027/archly/archly --HEAD
# or: brew tap sand1027/tap && brew install archly  (after homebrew-tap repo is published)

export PATH="$HOME/.local/bin:$PATH"
export ARCHLY_API_URL=http://localhost:8080
archly doctor
archly login
archly generate "Design a payments platform" -o payments.mmd
```

Or with Go: `go install github.com/sand1027/Archly/archly-cli@latest`

Docs: [`archly-cli/README.md`](archly-cli/README.md) · Plan: [`cliplan.md`](cliplan.md)

---

## Service Overview

| Container | Port | Description |
|-----------|------|-------------|
| `archly-web` | 3000 | Next.js frontend with hot-reload |
| `archly-api` | 8080 | Go REST + WebSocket API with Air hot-reload |
| `archly-db` | 5432 | PostgreSQL 16 |
| `archly-redis` | 6379 | Redis 7 |
| `archly-kafka` | 9092 | Kafka (Confluent) |
| `archly-zookeeper` | 2181 | Zookeeper (required by Kafka) |
| `archly-migrate` | — | Runs DB migrations on startup then exits |
| `archly-kafka-setup` | — | Creates Kafka topics then exits |

---

## Local Development (without Docker)

### Backend

```bash
cd archly-backend

# Install Air for hot-reload
go install github.com/air-verse/air@latest

# Copy env (edit DATABASE_URL, REDIS_URL, KAFKA_BROKERS to point to local services)
cp ../.env.example ../.env

# Run with hot-reload
air

# Or run directly
go run ./cmd/server/main.go
```

The API listens on `http://localhost:8080`.

### Frontend

```bash
cd archly-frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend listens on `http://localhost:3000`.

### Database migrations (without Docker)

```bash
# Install goose
go install github.com/pressly/goose/v3/cmd/goose@v3.21.1

# Run migrations
goose -dir archly-backend/internal/db/migrations \
  postgres "postgresql://postgres:password@localhost:5432/archly?sslmode=disable" up
```

---

## AI Diagram Generation

The AI feature requires at least one provider key. Both are free tier.

### Option A — Google Gemini (primary, 1500 req/day free)

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Add to `.env`:
   ```
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-2.0-flash
   ```

### Option B — OpenRouter (fallback, free models available)

1. Go to https://openrouter.ai/settings/keys
2. Create an API key
3. Add to `.env`:
   ```
   OPENROUTER_API_KEY=your-key-here
   OPENROUTER_MODEL=inclusionai/ling-3.0-flash:free
   ```

If both keys are set, Gemini is tried first and OpenRouter is used automatically on quota errors.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | Min 32 chars. Generate: `openssl rand -hex 32` |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `KAFKA_BROKERS` | No | `localhost:9092` | Comma-separated broker list |
| `GEMINI_API_KEY` | No | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model name |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `inclusionai/ling-3.0-flash:free` | OpenRouter model slug |
| `STRIPE_SECRET_KEY` | No | — | Stripe payments (optional) |
| `PORT` | No | `8080` | API server port |
| `ENVIRONMENT` | No | `development` | `development` or `production` |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |

---

## Useful Commands

```bash
# View logs for a specific service
docker compose logs -f api
docker compose logs -f web

# Rebuild a service after code changes
docker compose up -d --build api
docker compose up -d --build web

# Restart API only (picks up new env vars)
docker compose up -d --no-deps api

# Run database migrations manually
docker compose run --rm migrate

# Open a Postgres shell
docker compose exec db psql -U postgres -d archly

# List running containers
docker compose ps
```

---

## Project Structure

```
archly/
├── archly-backend/          # Go API
│   ├── cmd/server/          # Entry point
│   └── internal/
│       ├── config/          # Environment config
│       ├── db/migrations/   # SQL migrations (goose)
│       ├── handlers/        # HTTP handlers
│       ├── kafka/           # Producer, consumers, workers
│       ├── middleware/       # JWT, logging
│       ├── realtime/        # WebSocket hub
│       ├── services/        # Business logic (auth, AI, designs)
│       └── sqlc/            # Generated DB queries
├── archly-frontend/         # Next.js 14 app
│   └── src/
│       ├── app/             # App Router pages
│       ├── components/      # UI components
│       ├── hooks/           # React hooks
│       ├── lib/             # API client, utilities
│       └── store/           # Zustand stores
├── docker-compose.yml       # Full stack orchestration
├── .env.example             # Environment variable template
└── .gitignore
```
