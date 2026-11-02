# Developer entry points for the music licensing challenge. Everything here
# wraps `docker compose` (run from this directory), `cargo` (run from
# `backend/`, where `rust-toolchain.toml` pins the compiler) or `bun` (run
# from `frontend/`). `make` alone lists the targets. Override a variable on the command line, for example
# `make test-all DATABASE_URL=postgres://...` or `make up COMPOSE=docker-compose`.

COMPOSE      ?= docker compose
BACKEND      := backend
FRONTEND     := frontend
API          ?= http://localhost:8080
DATABASE_URL ?= postgres://licensing:licensing@localhost:5432/licensing
REDIS_URL    ?= redis://localhost:6379

.DEFAULT_GOAL := help
.PHONY: help env up up-datadog down reset build logs ps health psql infra dev fmt check test test-all clean \
        fe-install fe-dev fe-check fe-build fe-logs

help: ## List the targets
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-11s\033[0m %s\n", $$1, $$2}'

# Created from the example only when missing: never overwrites your settings.
.env:
	cp .env.example .env

env: .env ## Create .env from .env.example when it does not exist

##@ Docker stack (Postgres, Redis, backend and frontend images)
up: .env ## Start Postgres, Redis, the backend and the frontend (http://localhost:5173); builds the images, waits until healthy
	$(COMPOSE) up -d --build --wait
up-datadog: .env ## Same, plus the Datadog agent (needs DD_API_KEY in .env)
	$(COMPOSE) --profile datadog up -d --build --wait
down: ## Stop the stack, keep the data
	$(COMPOSE) down
reset: .env ## Stop the stack, drop its volumes and start again from the seed
	$(COMPOSE) down -v
	$(COMPOSE) up -d --build --wait
build: ## Build the backend and frontend images only
	$(COMPOSE) build backend frontend
logs: ## Follow the backend log (OTP codes and invitation emails are printed there)
	$(COMPOSE) logs -f backend
fe-logs: ## Follow the frontend (nginx) log
	$(COMPOSE) logs -f frontend
ps: ## Container status
	$(COMPOSE) ps
health: ## Ping the API
	curl -fsS $(API)/health && echo
psql: ## Open psql on the development database
	$(COMPOSE) exec postgres psql -U licensing -d licensing

##@ Backend from source (cargo, pinned toolchain)
infra: .env ## Start only Postgres and Redis, for the targets below
	$(COMPOSE) up -d --wait postgres redis
dev: infra ## Run the backend from source against the compose Postgres and Redis (reads .env)
	cd $(BACKEND) && cargo run
fmt: ## Format the workspace
	cd $(BACKEND) && cargo fmt --all
check: ## Format check and clippy, as CI runs them
	cd $(BACKEND) && cargo fmt --all --check && cargo clippy --workspace --all-targets --locked -- -D warnings
test: ## Unit tests (no database, no Redis)
	cd $(BACKEND) && cargo test --workspace --locked
test-all: infra ## Unit tests plus the database and Redis suites, as CI runs them
	cd $(BACKEND) && DATABASE_URL=$(DATABASE_URL) REDIS_URL=$(REDIS_URL) cargo test --workspace --locked -- --include-ignored
clean: ## Remove the cargo target directory
	cd $(BACKEND) && cargo clean

##@ Frontend from source (bun)
fe-install: ## Install the frontend dependencies (bun.lock is the lockfile)
	cd $(FRONTEND) && bun install --frozen-lockfile
fe-dev: ## Run the Vite dev server on http://localhost:5173, proxying /api to the backend on :8080
	cd $(FRONTEND) && bun run dev
fe-check: ## Lint, typecheck and unit tests, as CI runs them
	cd $(FRONTEND) && bun run lint && bun run typecheck && bun run test
fe-build: ## Production build into frontend/dist
	cd $(FRONTEND) && bun run build
