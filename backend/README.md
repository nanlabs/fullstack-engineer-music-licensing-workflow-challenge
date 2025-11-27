# Music Licensing Workflow Backend

## 🎵 Overview
This is the backend service for the Music Licensing Workflow system. It manages movies, scenes, songs, and the licensing lifecycle of tracks.

## 🛠️ Tech Stack
- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database**: PostgreSQL
- **ORM**: [Prisma](https://www.prisma.io/) (v5)
- **Real-time**: Socket.io (WebSockets)
- **Documentation**: Swagger / OpenAPI
- **Containerization**: Docker

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (v18+)

### Running Locally

1. **Start the Database**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Run Migrations**:
   ```bash
   npx prisma migrate dev
   ```

4. **Start the Server**:
   ```bash
   npm run start:dev
   ```

The server will start on `http://localhost:3000`.

## 📚 API Documentation

The API is documented using Swagger/OpenAPI.
- **Swagger UI**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **OpenAPI Spec**: `openapi.yml` (generated in the root directory)

## 🏗️ Architecture & Decisions

### Repository Pattern
We used the Repository Pattern to abstract data access logic from the business logic in Services. This makes the code more testable and maintainable.

### State Machine
The `TracksService` implements a state machine to manage `LicensingStatus` transitions (e.g., `PENDING` -> `NEGOTIATING` -> `APPROVED`). Invalid transitions throw a `BadRequestException`.

### Real-time Updates
We use a `LicensingGateway` (WebSocket) to broadcast `trackUpdated` events whenever a track's status changes. This allows the frontend to update the UI in real-time without polling.

### Prisma Version
We explicitly used **Prisma v5** instead of v7 to ensure compatibility with the current NestJS environment and avoid recent breaking changes in the generated client exports.

## 🧪 Running Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```
