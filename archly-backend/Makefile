.PHONY: build run dev test lint sqlc swagger tidy clean

# ── Binary ────────────────────────────────────────────────────────────────
BUILD_DIR := ./bin
BINARY    := $(BUILD_DIR)/server

build:
	@mkdir -p $(BUILD_DIR)
	go build -o $(BINARY) ./cmd/server

run: build
	$(BINARY)

# ── Development (Air hot-reload) ──────────────────────────────────────────
dev:
	@which air > /dev/null || go install github.com/air-verse/air@latest
	air -c .air.toml

# ── Tests ─────────────────────────────────────────────────────────────────
test:
	go test -race -count=1 ./...

test-cover:
	go test -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# ── Lint ──────────────────────────────────────────────────────────────────
lint:
	@which golangci-lint > /dev/null || go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	golangci-lint run ./...

# ── sqlc codegen ──────────────────────────────────────────────────────────
sqlc:
	@which sqlc > /dev/null || go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	cd internal/sqlc && sqlc generate

# ── Swagger (swaggo) ──────────────────────────────────────────────────────
swagger:
	@which swag > /dev/null || go install github.com/swaggo/swag/cmd/swag@latest
	swag init -g cmd/server/main.go -o openapi/

# ── Dependency management ─────────────────────────────────────────────────
tidy:
	go mod tidy

# ── Clean ─────────────────────────────────────────────────────────────────
clean:
	rm -rf $(BUILD_DIR) coverage.out coverage.html tmp/

# ── Database migrations (using goose) ─────────────────────────────────────
migrate-up:
	goose -dir internal/db/migrations postgres "$(DATABASE_URL)" up

migrate-down:
	goose -dir internal/db/migrations postgres "$(DATABASE_URL)" down

migrate-status:
	goose -dir internal/db/migrations postgres "$(DATABASE_URL)" status

migrate-create:
	goose -dir internal/db/migrations create $(name) sql
