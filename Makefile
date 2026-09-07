# saas-admin Makefile

APP       := saas-admin
GO        := go
BUN       := bun
BIN       := bin/$(APP)
WEB_DEPS  := web/node_modules/.saas-admin-install-stamp
VERSION   ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT    ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS   := -X github.com/wanan9999/saas-admin/internal/version.Version=$(VERSION) \
             -X github.com/wanan9999/saas-admin/internal/version.Commit=$(COMMIT) \
             -X github.com/wanan9999/saas-admin/internal/version.BuildDate=$(BUILD_DATE)

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ─── Build ────────────────────────────────────────

.PHONY: build
build: build-web build-go ## Build everything

.PHONY: build-go
build-go: ## Build Go binary
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o $(BIN) ./cmd/server

.PHONY: build-web
build-web: $(WEB_DEPS) ## Build frontend
	cd web && $(BUN) run build

$(WEB_DEPS): web/package.json web/bun.lock
	cd web && $(BUN) install --frozen-lockfile
	@touch $@

# ─── Dev ──────────────────────────────────────────

.PHONY: dev
dev: ## Run backend with hot reload (air)
	air

.PHONY: dev-web
dev-web: $(WEB_DEPS) ## Run frontend dev server
	cd web && $(BUN) run dev

# ─── Quality ──────────────────────────────────────

.PHONY: fmt
fmt: $(WEB_DEPS) ## Format all code
	@if command -v goimports >/dev/null 2>&1; then \
		goimports -w ./cmd/ ./internal/ ./pkg/; \
	else \
		gofmt -w ./cmd/ ./internal/ ./pkg/; \
	fi
	cd web && $(BUN) run fmt

.PHONY: lint
lint: $(WEB_DEPS) ## Lint all code
	$(GO) vet ./...
	cd web && $(BUN) run lint

.PHONY: test
test: ## Run all tests
	$(GO) test ./...

.PHONY: check
check: lint test build ## Full CI check (lint + test + build)

# ─── Database ─────────────────────────────────────

.PHONY: db-backup
db-backup: ## Backup database to backup.sql
	pg_dump "$${DATABASE_URL}" --no-owner --no-privileges > backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup saved to backup-*.sql"

.PHONY: db-restore
db-restore: ## Restore database from BACKUP=file.sql
	@test -n "$(BACKUP)" || (echo "Usage: make db-restore BACKUP=backup.sql" && exit 1)
	psql "$${DATABASE_URL}" < $(BACKUP)
	@echo "Restored from $(BACKUP)"

# ─── Docker ───────────────────────────────────────

.PHONY: docker-build
docker-build: ## Build Docker image locally
	docker build -t $(APP):$(VERSION) \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) .

.PHONY: docker-up
docker-up: ## Start with Docker Compose
	docker compose up -d

.PHONY: docker-down
docker-down: ## Stop Docker Compose
	docker compose down

.PHONY: docker-logs
docker-logs: ## Tail Docker Compose logs
	docker compose logs -f saas-admin

# ─── Clean ────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf bin/ web/dist tmp/

.PHONY: clean-all
clean-all: clean ## Remove everything including node_modules
	rm -rf web/node_modules
