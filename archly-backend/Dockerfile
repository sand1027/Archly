# ── Production multi-stage build ──────────────────────────────────────────
# Stage 1: build
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /app/bin/server ./cmd/server

# Stage 2: minimal runtime (~15 MB)
FROM scratch AS runner

# CA certs for HTTPS calls (OpenAI, Stripe)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

COPY --from=builder /app/bin/server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
