.PHONY: help up up-build down logs ps \
        backend-run backend-build backend-test backend-check backend-fmt backend-clippy \
        frontend-dev frontend-build frontend-lint frontend-install \
        infra-init infra-init-local infra-plan infra-apply infra-validate infra-fmt infra-lint \
        clean env

help:
	@echo "Music Licensing Workflow — root targets"
	@echo ""
	@echo "Docker Compose (full stack):"
	@echo "  make up             - Start postgres + backend + frontend"
	@echo "  make up-build       - Rebuild images and start the full stack"
	@echo "  make down           - Stop the full stack"
	@echo "  make logs           - Tail logs for all services"
	@echo "  make ps             - Show service status"
	@echo "  make env            - Copy .env.example to .env if missing"
	@echo ""
	@echo "Backend (delegates to backend/Makefile):"
	@echo "  make backend-run    - Run the backend locally with cargo"
	@echo "  make backend-build  - cargo build"
	@echo "  make backend-test   - cargo test"
	@echo "  make backend-check  - fmt-check + clippy + test"
	@echo "  make backend-fmt    - cargo fmt"
	@echo "  make backend-clippy - cargo clippy"
	@echo ""
	@echo "Frontend:"
	@echo "  make frontend-install - npm install"
	@echo "  make frontend-dev     - npm run dev (Vite dev server)"
	@echo "  make frontend-build   - npm run build"
	@echo "  make frontend-lint    - npm run lint"
	@echo ""
	@echo "Infra (Terraform, in infra/terraform):"
	@echo "  make infra-init     - terraform init with real backend config (requires infra/terraform/backend-config.hcl)"
	@echo "  make infra-init-local - terraform init without a remote backend (for validate/lint only)"
	@echo "  make infra-validate - terraform validate"
	@echo "  make infra-fmt      - terraform fmt -recursive"
	@echo "  make infra-lint     - tflint --recursive"
	@echo "  make infra-plan     - terraform plan"
	@echo "  make infra-apply    - terraform apply"
	@echo ""
	@echo "  make clean          - Remove build artifacts (backend target/, frontend dist/)"

env:
	@test -f .env || cp .env.example .env

up: env
	docker compose up

up-build: env
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

backend-run:
	$(MAKE) -C backend run

backend-build:
	$(MAKE) -C backend build

backend-test:
	$(MAKE) -C backend test

backend-check:
	$(MAKE) -C backend check

backend-fmt:
	$(MAKE) -C backend fmt

backend-clippy:
	$(MAKE) -C backend clippy

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npm run lint

infra-init:
	cd infra/terraform && terraform init -backend-config=backend-config.hcl

infra-init-local:
	cd infra/terraform && terraform init -backend=false

infra-validate:
	cd infra/terraform && terraform validate

infra-fmt:
	cd infra/terraform && terraform fmt -recursive

infra-lint:
	cd infra/terraform && tflint --recursive

infra-plan:
	cd infra/terraform && terraform plan

infra-apply:
	cd infra/terraform && terraform apply

clean:
	$(MAKE) -C backend clean
	rm -rf frontend/dist
