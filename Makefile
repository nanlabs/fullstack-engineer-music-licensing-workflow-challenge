# Developer entry points for the music licensing challenge. Everything here
# wraps `docker compose` (run from this directory) or `cargo` (run from
# `backend/`, where `rust-toolchain.toml` pins the compiler). `make` alone
# lists the targets. Override a variable on the command line, for example
# `make test-all DATABASE_URL=postgres://...` or `make up COMPOSE=docker-compose`.

COMPOSE      ?= docker compose
BACKEND      := backend
API          ?= http://localhost:8080
DATABASE_URL ?= postgres://licensing:licensing@localhost:5432/licensing
REDIS_URL    ?= redis://localhost:6379

.DEFAULT_GOAL := help
.PHONY: help env up up-datadog down reset build logs ps health psql infra dev fmt check test test-all clean

help: ## List the targets
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-11s\033[0m %s\n", $$1, $$2}'

# Created from the example only when missing: never overwrites your settings.
.env:
	cp .env.example .env

env: .env ## Create .env from .env.example when it does not exist

##@ Docker stack (Postgres, Redis, backend image)
up: .env ## Start Postgres, Redis and the backend; builds the image, waits until healthy
	$(COMPOSE) up -d --build --wait
up-datadog: .env ## Same, plus the Datadog agent (needs DD_API_KEY in .env)
	$(COMPOSE) --profile datadog up -d --build --wait
down: ## Stop the stack, keep the data
	$(COMPOSE) down
reset: .env ## Stop the stack, drop its volumes and start again from the seed
	$(COMPOSE) down -v
	$(COMPOSE) up -d --build --wait
build: ## Build the backend image only
	$(COMPOSE) build backend
logs: ## Follow the backend log (OTP codes and invitation emails are printed there)
	$(COMPOSE) logs -f backend
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
