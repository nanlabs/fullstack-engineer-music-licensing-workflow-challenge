# Music Licensing Workflow System

A fullstack application for **ACME BROS PICTURES** to manage music licensing for movie scenes. Built with a microservices architecture using NestJS, React/Next.js, PostgreSQL, and RabbitMQ.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Real-Time Updates](#real-time-updates)
- [Testing](#testing)
- [Tech Decisions & Tradeoffs](#tech-decisions--tradeoffs)
- [Project Structure](#project-structure)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Next.js)                              │
│                              localhost:3005                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP / SSE
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Gateway (NestJS)                               │
│                              localhost:3000                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   /movies   │  │   /songs    │  │   /tracks   │  │ /sse/notifications  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         │                   │                   │                   ▲
         │ RabbitMQ          │ RabbitMQ          │ RabbitMQ          │ TCP
         ▼                   ▼                   ▼                   │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐         │
│  Movie Service  │ │  Song Service   │ │  Track Service  │─────────┘
│                 │ │                 │ │                 │  (emits events)
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │     PostgreSQL      │
                  │    (shared DB)      │
                  └─────────────────────┘
```

## Tech Stack

| Layer                | Technology                       | Purpose                                  |
| -------------------- | -------------------------------- | ---------------------------------------- |
| **Frontend**         | Next.js 15, React 19, TypeScript | UI with SSR support                      |
| **API Gateway**      | NestJS                           | REST API, SSE endpoints, request routing |
| **Microservices**    | NestJS                           | Domain-specific business logic           |
| **Message Broker**   | RabbitMQ                         | Async communication between services     |
| **Database**         | PostgreSQL 16                    | Primary data store                       |
| **ORM**              | TypeORM                          | Database abstraction                     |
| **Containerization** | Docker, Docker Compose           | Local development & deployment           |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)
- pnpm (recommended) or npm

### Quick Start with Docker

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd fullstack-engineer-music-licensing-workflow-challenge
   ```

2. **Start all services**

   ```bash
   docker compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3005
   - API Gateway: http://localhost:3000
   - RabbitMQ Management: http://localhost:15672 (guest/guest)

### Local Development (without Docker)

1. **Start infrastructure services**

   ```bash
   docker compose up postgres rabbit-mq -d
   ```

2. **Install backend dependencies**

   ```bash
   cd backend
   pnpm install
   ```

3. **Start backend services** (in separate terminals)

   ```bash
   # Terminal 1 - API Gateway
   pnpm run start:dev api-gateway

   # Terminal 2 - Movie Service
   pnpm run start:dev movie

   # Terminal 3 - Song Service
   pnpm run start:dev song

   # Terminal 4 - Track Service
   pnpm run start:dev track
   ```

4. **Install and start frontend**
   ```bash
   cd frontend
   pnpm install
   cp .env.local.example .env.local
   pnpm dev
   ```

### Environment Variables

Copy `.env.example` to `.env` at the project root:

```env
# Database (PostgreSQL)
DB_HOST=postgres
DB_PORT=5432
DB_USER=acme_user
DB_PASSWORD=acme_password
DB_NAME=acme_music_licensing

# RabbitMQ
RMQ_HOST=rabbit-mq
RMQ_PORT=5672

# API Gateway
BACKEND_PORT=3000
API_GATEWAY_HOST=api-gateway
API_GATEWAY_PORT=8000

# Frontend
CLIENT_PORT=3005
```

## API Documentation

### Movies

| Method | Endpoint         | Description                     |
| ------ | ---------------- | ------------------------------- |
| GET    | `/movies`        | List all movies                 |
| POST   | `/movies`        | Create a movie                  |
| GET    | `/movies/scenes` | List all scenes with movie info |
| POST   | `/movies/scenes` | Create a scene for a movie      |

### Songs

| Method | Endpoint | Description    |
| ------ | -------- | -------------- |
| GET    | `/songs` | List all songs |
| POST   | `/songs` | Create a song  |

### Tracks

| Method | Endpoint                | Description                              |
| ------ | ----------------------- | ---------------------------------------- |
| GET    | `/tracks`               | List all tracks with relations           |
| GET    | `/tracks/:id`           | Get a specific track                     |
| POST   | `/tracks`               | Create a track (associate song to scene) |
| PATCH  | `/tracks/:id/licensing` | Update licensing status                  |

### SSE (Server-Sent Events)

| Endpoint                              | Event Type         | Description              |
| ------------------------------------- | ------------------ | ------------------------ |
| `/sse/notifications/licensing-status` | `licensing-status` | Licensing status changes |
| `/sse/notifications/track-created`    | `track-created`    | New track created        |

### Example Requests

**Create a Movie:**

```bash
curl -X POST $BASE/movies \
    -H "Content-Type: application/json" \
    -d '{"title": "The Matrix", "encodingFormat": "Blu-ray", "releaseDate": 1999}'
```

**Create a Movie Scene:**

```bash
curl -X POST $BASE/movies/scenes \
    -H "Content-Type: application/json" \
    -d '{"movieId": 1, "name": "Neo takes the red pill"}'
```

**Create a Song:**

```bash
curl -X POST $BASE/songs \
    -H "Content-Type: application/json" \
    -d '{"title": "Clubbed to Death", "releaseDate": 1999, "seconds": 420}'
```

**Create a Track:**

```bash
curl -X POST http://localhost:3000/tracks \
  -H "Content-Type: application/json" \
  -d '{
    "songId": 1,
    "movieSceneId": 1,
    "startTime": 0,
    "endTime": 180
  }'
```

**Listen to Licensing Status Update**

```bash
curl -N $BASE/sse/notifications/licensing-status
```

**Update Licensing Status:**

```bash
curl -X PATCH http://localhost:3000/tracks/1/licensing \
  -H "Content-Type: application/json" \
  -d '{"status": "LICENSED"}'
```

**Licensing Status Values:** `UNLICENSED`, `IN_NEGOTIATION`, `LICENSED`

## Real-Time Updates

The application uses **Server-Sent Events (SSE)** for real-time notifications.

### Why SSE over WebSockets?

| Aspect           | SSE                              | WebSockets            |
| ---------------- | -------------------------------- | --------------------- |
| **Direction**    | Server → Client (unidirectional) | Bidirectional         |
| **Protocol**     | HTTP                             | Custom protocol       |
| **Reconnection** | Automatic                        | Manual implementation |
| **Complexity**   | Simple                           | More complex          |
| **Use Case Fit** | Notifications, live feeds        | Chat, gaming          |

For this use case (broadcasting licensing status updates), SSE is the better choice because we only need server-to-client communication. WebSockets implies more overhead than SSE for a notifications functionality

### Frontend Integration

```javascript
const eventSource = new EventSource("/sse/notifications/licensing-status");

// Named events require addEventListener (not onmessage)
eventSource.addEventListener("licensing-status", (event) => {
  const data = JSON.parse(event.data);
  console.log("Status updated:", data);
});
```

## Testing

### Run All Tests

```bash
cd backend
pnpm test
```

### Test Coverage

```bash
pnpm test:cov
```

### Current Test Suite

- **121 tests** across 12 test suites
- Unit tests for all controllers and services
- Mocked dependencies for isolated testing

## Tech Decisions & Tradeoffs

### 1. REST vs GraphQL

**Decision:** REST API

**Reasoning:**

- Simpler to implement and debug
- Better caching with HTTP standards
- Sufficient for the CRUD operations required
- SSE integrates naturally with REST

**Tradeoff:** GraphQL would provide more flexibility for complex queries and reduce over-fetching, but adds complexity in both backend and frontend; especially, by integrating subscriptions!

### 2. Microservices Architecture

**Decision:** Separate services for Movie, Song, and Track domains

**Reasoning:**

- Clear domain boundaries (Single Responsibility)
- Independent scaling potential
- Demonstrates distributed systems knowledge
- Matches real-world enterprise patterns

**Tradeoff:** Added complexity vs a monolith. For a small team, a modular monolith might be simpler. However, the microservices pattern showcases architectural skills.

### 3. RabbitMQ vs Kafka

**Decision:** RabbitMQ

**Reasoning:**

- Simpler setup and operations
- Lower resource footprint
- Sufficient for request-reply and event patterns
- Great NestJS integration

**Tradeoff:** Kafka provides better throughput and replay capabilities. A possible use case could be to implement track history persistence.

### 4. Shared Database vs Database-per-Service

**Decision:** Shared PostgreSQL database

**Reasoning:**

- Simpler local development
- Reduced infrastructure complexity
- ACID transactions across entities

**Tradeoff:** True microservices would have separate databases. However, it also entails extra configuration, architecture decisions and testing setup. In an ideal scenario this kind of infrastructure can be deployed using technologies like ECS from AWS. The codebase would also be largely increased by implementing robust business logic and domain logic that prevents data inconsistencies and/or domain-specific anomalies.

## Project Structure

```
/
├── compose.yml              # Docker Compose configuration
├── .env                     # Environment variables
├── README.md                # This file
│
├── backend/
│   ├── apps/
│   │   ├── api-gateway/     # HTTP API + SSE endpoints
│   │   ├── movie/           # Movie microservice
│   │   ├── song/            # Song microservice
│   │   └── track/           # Track microservice
│   ├── libs/
│   │   ├── database/        # TypeORM configuration
│   │   ├── shared/          # Shared entities, DTOs, constants
│   │   └── rmq-env-config/  # RabbitMQ configuration
│   ├── Dockerfile.*         # Service-specific Dockerfiles
│   └── package.json
│
└── frontend/
    ├── app/
    │   ├── components/      # React components
    │   ├── hooks/           # Custom hooks (useSSE)
    │   ├── lib/             # API client
    │   └── types/           # TypeScript types
    ├── Dockerfile.frontend
    └── package.json
```

## Data Model

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   Movie     │       │   MovieScene    │       │    Track    │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id          │──┐    │ id              │──┐    │ id          │
│ title       │  └───▶│ name            │  └───▶│ startTime   │
│ releaseDate │       │ movie_id (FK)   │       │ endTime     │
│ encoding    │       └─────────────────┘       │ scene_id    │
└─────────────┘                                 │ song_id     │
                                                │ licensing_id│
┌─────────────┐       ┌─────────────────┐       └──────┬──────┘
│    Song     │       │    Licensing    │              │
├─────────────┤       ├─────────────────┤              │
│ id          │◀──────│ id              │◀─────────────┘
│ title       │       │ status          │
│ releaseDate │       │ (UNLICENSED,    │
│ seconds     │       │  IN_NEGOTIATION,│
└─────────────┘       │  LICENSED)      │
                      └─────────────────┘
```

## Future Improvements

- [ ] Add GitHub Actions CI/CD pipeline
- [ ] Implement user authentication (JWT)
- [ ] Add pagination for list endpoints
- [ ] Database-per-service with event sourcing
- [ ] Kubernetes deployment manifests
- [ ] E2E tests with Playwright
- [ ] API rate limiting
- [ ] OpenAPI/Swagger documentation
