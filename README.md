# Music Licensing Workflow API

Backend-only implementation of the NaNLABS Fullstack Engineer Challenge. The service exposes a NestJS API with PostgreSQL persistence, Redis-backed WebSockets, Dockerized infrastructure, and CI-ready tooling.

---

## Tech Stack

- Node.js 20, NestJS, TypeScript
- PostgreSQL, Redis
- Docker & Docker Compose
- Jest (unit + integration tests)
- ESLint, GitHub Actions CI

---

## Prerequisites

- Docker Desktop (recommended to inspect logs)
- Docker Compose
- Copy `.env.example` to `.env` at the repository root and adjust values as needed

---

## Getting Started

From the repository root, start the full stack:

```
docker compose up --watch --build
```

Services launched:

- `backend` (instance 1)
- `backend-2` (instance 2 for distributed WebSocket testing)
- `postgres`
- `redis`

Swagger UIs:

- Backend 1: http://localhost:3000/api/v1/swagger
- Backend 2: http://localhost:3001/api/v1/swagger

The `docs/NaNLABS Challenge.postman_collection.json` Postman collection contains scripted flows that automatically re-use IDs between requests, making manual testing easy. At any time you can call the `/seed` endpoint (via Swagger or Postman) to wipe databases and reinsert demo data.

---

## Database Access

Use pgAdmin at http://localhost:5050/

- Email: `admin@example.com`
- Password: `admin123`

Add the server:

1. Right-click **Servers** → **Register** → **Server…**
2. In **General**, set any name.
3. In **Connection**:
   - Host: `db`
   - Username: `postgres`
   - Password: `postgres`
4. Save, then browse `Servers > music > Schemas > public > Tables` and use _View/Edit Data → All Rows_ to inspect data.

---

## WebSocket Testing

1. Run the `/seed` endpoint to preload demo data.
2. Open both Swagger UIs (ports 3000 and 3001) and launch the browser devtools console (F12).
3. Copy the script from `docs/test-socket.js` into each console. The file includes a comment showing where to adapt the scene ID if needed.
4. Trigger `PATCH /api/v1/tracks/status/tracks/6ae31240-2601-4b68-a8d4-21bb06e75ab9` (pre-filled in Swagger). Both consoles should log the status change, demonstrating Redis-backed synchronization between backend instances.

---

## Testing & Tooling

I keep expanding my automated testing practice, so the current suite prioritizes the most critical services first. Unit tests cover the business logic entry points, while integration tests exercise the workflow against the real Docker services.

### Unit tests

1. `cd backend`
2. Install dependencies: `npm install`
3. Run them locally: `npm run test`

### Integration tests

1. Ensure `docker compose up --watch --build` is already running so PostgreSQL and Redis are available.
2. From a second terminal: `cd backend && npm run test:e2e`

### Continuous integration

The GitHub Actions workflow at `.github/workflows/backend-ci.yml` lints the codebase and runs the unit test suite on every push. Integration tests remain manual because they depend on the Docker stack.
