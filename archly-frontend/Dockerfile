# ─── Production image — multi-stage build ────────────────────────────────
#
# Stage 1 (deps):    Install production + dev deps for the build step
# Stage 2 (builder): Run `next build` — produces the .next standalone output
# Stage 3 (runner):  Minimal runtime image (~160 MB) with only what's needed
#
# Produces a Next.js standalone output so node_modules are NOT copied in
# full — only the files Next.js traces as actually required.
#
# Usage:
#   docker build -t archly-frontend:latest .
#   docker run -p 3000:3000 \
#     -e NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
#     -e NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com \
#     archly-frontend:latest

# ── Stage 1: install deps ──────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

# Install all deps (dev too — needed for next build type-checking)
RUN npm ci

# ── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Tell Next.js to emit a standalone build — smaller final image
# (set in next.config.ts output: "standalone")
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build — generates .next/standalone + .next/static
RUN npm run build

# ── Stage 3: production runner ─────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only the standalone output + static assets
COPY --from=builder /app/public ./public

# next build with output: "standalone" puts everything needed into .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# The standalone server.js is the entrypoint
CMD ["node", "server.js"]
