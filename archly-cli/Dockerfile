# ── Production multi-stage build for Archly CLI ─────────────────────────────
# Stage 1: build
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=0.1.0-docker
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.version=${VERSION}" -o /out/archly .

# Stage 2: minimal runtime
FROM alpine:3.20 AS runner

RUN apk add --no-cache ca-certificates tzdata su-exec \
  && adduser -D -u 10001 -h /home/archly archly \
  && mkdir -p /home/archly/.archly \
  && chown -R archly:archly /home/archly

COPY --from=builder /out/archly /usr/local/bin/archly
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /work

ENV ARCHLY_API_URL=http://api:8080 \
    ARCHLY_APP_URL=http://web:3000 \
    HOME=/home/archly

# Entrypoint runs as root only to chown the volume, then su-exec → archly
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sleep", "infinity"]
