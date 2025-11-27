# 🎵 Music Licensing Workflow System

**Author**: [Your Name / OssFit Candidate]

## 📋 Overview

This project implements a backend system for managing the music licensing process in movie production. It allows managing **Movies**, **Scenes**, **Songs**, and **Tracks**, tracking the licensing status of each track through a state machine workflow.

The system is designed to be **scalable**, **real-time**, and **containerized**.

---

## 🛠️ Tech Stack & Architecture Decisions

### 1. Backend Framework: **NestJS**
- **Decision**: Chosen for its modular architecture, strong TypeScript support, and dependency injection system.
- **Benefit**: Ensures code maintainability and testability.

### 2. Database & ORM: **PostgreSQL + Prisma**
- **Decision**: Used **PostgreSQL** for robust relational data management.
- **Decision**: Selected **Prisma (v5)** as the ORM.
    - *Note*: We explicitly used v5 to ensure stability with the current NestJS environment, avoiding recent breaking changes in v7.
- **Schema**: Defined models for `Movie`, `Scene`, `Song`, and `Track` with proper foreign key relationships.

### 3. Real-time Updates: **WebSockets + Redis**
- **Decision**: Implemented a **Pub/Sub architecture** using **Redis**.
- **Flow**:
    1.  `TracksService` updates a status -> Publishes event to Redis (`track_updates`).
    2.  `LicensingGateway` subscribes to Redis -> Broadcasts to WebSocket clients.
- **Benefit**: Decouples the business logic from the WebSocket gateway, allowing the system to scale horizontally (e.g., multiple backend instances).

### 4. Design Patterns
- **Repository Pattern**: Abstracted data access into `BaseRepository` and specific repositories (e.g., `TracksRepository`). This separates business logic from database queries.
- **State Machine**: Implemented in `TracksService` to enforce valid transitions for `LicensingStatus` (`PENDING` -> `NEGOTIATING` -> `APPROVED`/`REJECTED`).

---

## 🚀 Setup & Running

The entire application is containerized using **Docker**.

### Prerequisites
- Docker & Docker Compose
- Node.js (v18+) (for local development/testing)

### Steps

1.  **Clone the repository**:
    ```bash
    git clone <repo-url>
    cd fullstack-engineer-music-licensing-workflow-challenge
    ```

2.  **Start Services**:
    ```bash
    docker-compose up -d --build
    ```
    This will start:
    - **Backend API** (Port 3000)
    - **PostgreSQL** (Port 5432)
    - **Redis** (Port 6379)

3.  **Access API Documentation**:
    Open your browser at: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 🧪 Testing

We have implemented both Unit and End-to-End (E2E) tests.

### Running Tests
```bash
cd backend

# Unit Tests (State Machine logic, etc.)
npm run test

# E2E Tests (Full workflow: Create Movie -> Scene -> Song -> Track -> Update Status)
npm run test:e2e
```

### CI/CD
A **GitHub Actions** workflow (`.github/workflows/ci.yml`) is configured to automatically run:
- Dependency installation
- Prisma Client generation
- Unit Tests
On every push to `main`.

---

## 🔮 Future Improvements (Roadmap)

While the backend is robust, here are the next steps to enhance the project:

1.  **Frontend Implementation**:
    - Build a React/Vite dashboard to visualize movies and tracks.
    - Connect to the WebSocket gateway to show real-time status updates.

2.  **Authentication & Authorization**:
    - Implement JWT Guard to secure endpoints.
    - Add Roles (e.g., `Admin` can approve, `Producer` can only view).

3.  **Advanced Notifications**:
    - Integrate **AWS SNS** to send emails or SMS when a track is approved.

4.  **Cloud Deployment**:
    - Deploy to **AWS EC2** or similar cloud provider.
    - Set up a production-ready database (e.g., AWS RDS).

---

## 📂 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── common/         # Base Repository
│   │   ├── licensing/      # WebSocket Gateway
│   │   ├── movies/         # Movies Module
│   │   ├── redis/          # Redis Module
│   │   ├── scenes/         # Scenes Module
│   │   ├── songs/          # Songs Module
│   │   ├── tracks/         # Tracks Module (State Machine)
│   │   └── main.ts         # App Entry & Swagger Setup
│   ├── test/               # E2E Tests
│   ├── prisma/             # Database Schema & Migrations
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```
