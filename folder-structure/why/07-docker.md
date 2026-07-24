# Why: Docker Setup

## Overview
Docker runs every service in an isolated container. One command starts everything:
```bash
docker compose up
```
This starts PostgreSQL, Redis, Zookeeper, Kafka, the Go API, the Next.js frontend,
and a migration runner — all connected on the same internal network.

## Why Docker for local development?
- No "works on my machine" — everyone runs identical environments
- No manual installation of PostgreSQL, Redis, Kafka, or Zookeeper
- Production uses the same Docker images — fewer surprises at deploy time

## Services breakdown

| Service | Image | Port | Why |
|---|---|---|---|
| `web` | Built from `apps/web/Dockerfile.dev` | 3000 | Next.js with volume mount for hot reload |
| `api` | Built from `apps/api/Dockerfile.dev` | 8080 | Go with Air hot reload |
| `db` | `postgres:16-alpine` | 5432 | Primary datastore |
| `redis` | `redis:7-alpine` | 6379 | Sessions, share link TTL, rate limiting, WS pub/sub |
| `zookeeper` | `confluentinc/cp-zookeeper:7.6.0` | 2181 | Required by Kafka for broker coordination |
| `kafka` | `confluentinc/cp-kafka:7.6.0` | 9092 (host) / 29092 (internal) | Async event streaming |
| `migrate` | `migrate/migrate:v4.17.0` | — | Runs SQL migrations once on startup then exits |

## Why two kafka listener ports?
- Port `29092` — used by Go API inside Docker network (hostname `kafka`)
- Port `9092` — exposed to your machine for debugging with Kafka CLI tools

## Named volumes

| Volume | Why |
|---|---|
| `postgres_data` | Database files survive `docker compose down` and `docker compose up` |
| `kafka_data` | Kafka message logs survive restarts — no replayed events on restart |
| `redis_data` | Redis AOF persistence — share links survive restarts |

## Why Air for Go hot reload?
Go must be recompiled on every change (unlike Node.js). Air watches for `.go` file changes,
recompiles the binary in the background, and restarts the server — typically in under 1 second.
Without Air, you would stop/recompile/restart manually on every change.

## Dockerfile strategy — multi-stage builds

`apps/api/Dockerfile` (production):
```
Stage 1: golang:1.23-alpine — downloads deps, compiles binary
Stage 2: alpine:latest — copies only the ~10MB binary
Final image: ~15MB
```

`apps/web/Dockerfile` (production):
```
Stage 1: node:20-alpine — npm ci, next build, outputs standalone
Stage 2: node:20-alpine — copies .next/standalone only
Final image: ~150MB
```

Small images = faster deploys, less bandwidth, faster cold starts.

## Health checks
Every infrastructure service has a health check. The `api` container uses `depends_on`
with `condition: service_healthy` on `db`, `redis`, and `migrate`. This means:
- The API never starts before PostgreSQL is accepting connections
- The API never starts before migrations have run
- No race conditions on `docker compose up`
