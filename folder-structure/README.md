# PaperDraw — Folder Structure Documentation

Every folder in this project exists for a reason. This document explains what each folder does,
why it was created, and how it fits into the overall architecture.

---

## Diagrams

| Diagram | Description |
|---|---|
| [01 - Root Monorepo](./diagrams/01-root-monorepo.mmd) | Top-level folder layout |
| [02 - Web Frontend](./diagrams/02-web-frontend.mmd) | apps/web Next.js structure |
| [03 - API Backend](./diagrams/03-api-backend.mmd) | apps/api Go structure |
| [04 - Kafka Flow](./diagrams/04-kafka-flow.mmd) | Event flow through Kafka topics |
| [05 - Packages Shared](./diagrams/05-packages-shared.mmd) | packages/types and codegen |
| [06 - Real-time Collab](./diagrams/06-realtime-collab.mmd) | WebSocket hub + Redis pub/sub |
| [07 - Docker Setup](./diagrams/07-docker-setup.mmd) | All Docker services wired together |

---

## Why Documents

| Document | Explains |
|---|---|
| [01 - Root Monorepo](./why/01-root-monorepo.md) | Why a monorepo, why Turborepo |
| [02 - Web Frontend](./why/02-web-frontend.md) | Every folder in apps/web, why simulation is client-side |
| [03 - API Backend](./why/03-api-backend.md) | Every folder in apps/api, layered architecture |
| [04 - Kafka](./why/04-kafka.md) | Why Kafka, topics, async vs sync |
| [05 - Packages Shared](./why/05-packages-shared.md) | Why shared types, codegen pipeline |
| [06 - Real-time](./why/06-realtime.md) | Why WebSocket, hub architecture, Redis pub/sub |
| [07 - Docker](./why/07-docker.md) | Every Docker service, volumes, multi-stage builds |

---

## Regenerate Images

```bash
cd folder-structure
for f in diagrams/*.mmd; do
  name=$(basename "$f" .mmd)
  mmdc -i "$f" -o "images/${name}.png"
done
```
