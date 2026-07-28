.PHONY: build install test clean docker

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "0.1.0-dev")
LDFLAGS := -ldflags "-X main.version=$(VERSION)"
PREFIX  ?= $(HOME)/.local/bin

build:
	go build $(LDFLAGS) -o archly .

# Build/start via root Archly docker-compose.yml
docker:
	cd .. && docker compose up -d --build cli

install: build
	install -d $(PREFIX)
	install -m 0755 archly $(PREFIX)/archly
	@echo "Installed $(PREFIX)/archly ($(VERSION))"

test:
	go test ./...

clean:
	rm -f archly
