# Why: Root Monorepo Structure

## What is a monorepo?
A monorepo is a single Git repository that contains multiple projects (apps and packages).
Instead of separate repos for frontend and backend, everything lives together and shares tooling.

## Why we chose this

| Folder / File | Why it exists |
|---|---|
| `apps/` | Contains runnable applications — things that start a server or serve a page |
| `packages/` | Contains shared code used by multiple apps — types, codegen config |
| `architecture/` | Mermaid diagrams documenting the full system design |
| `folder-structure/` | This documentation — explains every folder and why it exists |
| `scripts/` | Shell scripts for codegen, migrations, seeding, Kafka topic creation |
| `.github/workflows/` | Automates testing and deployment on every git push |
| `docker-compose.yml` | One command (`docker compose up`) starts all 7 services locally |
| `docker-compose.dev.yml` | Dev overrides — adds volume mounts for hot reload without rebuilding images |
| `.env.example` | Template showing every env var needed — teammates copy this to `.env` |
| `turbo.json` | Turborepo knows the build order — generate types before building the frontend |
| `package.json` (root) | Declares npm workspaces — `npm install` at root installs all package deps |

## Why Turborepo specifically?
- Caches build outputs — unchanged packages are not rebuilt
- Runs tasks in the right dependency order automatically
- `generate` task runs before `build` so TypeScript types are always fresh
- One command (`turbo run build`) validates the entire project
