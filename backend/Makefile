.PHONY: help run build release test test-verbose fmt fmt-check clippy check lint watch clean db-up db-down docker-build docker-run

help:
	@echo "Backend targets:"
	@echo "  make run           - Run the API locally (cargo run)"
	@echo "  make build         - Debug build"
	@echo "  make release       - Release build"
	@echo "  make test          - Run all tests (unit + integration, uses testcontainers)"
	@echo "  make test-verbose  - Run tests with output shown"
	@echo "  make fmt           - Format code (cargo fmt)"
	@echo "  make fmt-check     - Check formatting without modifying files"
	@echo "  make clippy        - Run clippy lints (warnings as errors)"
	@echo "  make check         - fmt-check + clippy + test (what CI should run)"
	@echo "  make watch         - Rebuild and re-run on file changes (requires cargo-watch)"
	@echo "  make clean         - Remove build artifacts"
	@echo "  make db-up         - Start a local Postgres via docker compose"
	@echo "  make db-down       - Stop the local Postgres"
	@echo "  make docker-build  - Build the backend Docker image"
	@echo "  make docker-run    - Run the backend Docker image"

run:
	cargo run

build:
	cargo build

release:
	cargo build --release

test:
	cargo test

test-verbose:
	cargo test -- --nocapture

fmt:
	cargo fmt

fmt-check:
	cargo fmt --check

clippy:
	cargo clippy --all-targets -- -D warnings

check: fmt-check clippy test

watch:
	cargo watch -x run

clean:
	cargo clean

db-up:
	docker compose up -d postgres

db-down:
	docker compose stop postgres

docker-build:
	docker build -t music-licensing-backend .

docker-run:
	docker run --rm -p 8080:8080 --env-file ../.env music-licensing-backend
