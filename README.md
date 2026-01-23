##  🎬  Music Licensing Workflow Platform
A full-stack application designed to manage and track the licensing workflow for movie tracks. This platform provides a centralized dashboard for real-time status updates and data management.

### 🚀 Quick Start (Docker)
The entire ecosystem is containerized for a seamless setup.

Clone the repository:

```bash
git clone https://github.com/nanlabs/fullstack-engineer-music-licensing-workflow-challenge.git 
cd fullstack-engineer-music-licensing-workflow-challenge
```

Spin up the environment:

```bash
docker-compose up --build
```

### Access Points:

**Frontend:** http://localhost (Port 80)

**Backend API:** http://localhost:3000

**Swagger Documentation:** http://localhost:3000/api

**Database:** localhost:5432 (PostgreSQL)

### 🛠 Tech Stack & Decisions
**Backend:** NestJS & Prisma 7
Architecture: NestJS was chosen for its modularity and dependency injection, ensuring the codebase remains maintainable as the workflow complexity grows.

**ORM:** Prisma 7 was selected for its superior Type Safety.

**Tradeoff:** Prisma 7 deprecated connection URLs in the schema file. I implemented a prisma.config.ts strategy to bridge environment variables from Docker into the Prisma engine, ensuring a secure and flexible configuration.

**Frontend:** React, Vite & Tailwind
**Performance:** Vite provides an ultra fast development experience.

**Styling:** Tailwind CSS was used for rapid UI development with a focus on a clean, professional workspace aesthetic.

**DevOps:** Docker Multi-stage Builds
**Efficiency:** Both Frontend and Backend use multi-stage builds.

**Benefit:** This significantly reduces the final image size and ensures that build-only dependencies are not present in the production-ready containers.

### 📡 API Architecture: REST & WebSockets
The system utilizes a Hybrid Communication Model to balance reliability with real-time requirements.

REST API (CRUD Operations)
Used for managing Movies, Tracks, and Licenses.

**Reasoning:** REST is the industry standard for state persistence. It offers excellent predictability, ease of testing, and straightforward documentation via Swagger.

WebSockets (Real-time Status)
Powered by Socket.io.

**Reasoning:** In a licensing workflow, status changes (e.g., from Negotiating to Approved) are critical. WebSockets eliminate the need for manual refreshing or expensive polling, allowing all connected collaborators to see progress instantly as it happens.

### 🏗 Backend Architecture: Clean Architecture

The backend follows **Clean Architecture** principles, ensuring that the business logic remains decoupled from the technical implementation and external frameworks.

### **Folder Structure & Layers**
* **`domain/`**: Contains the core business entities and repository interfaces. This is the heart of the application and has no external dependencies.
* **`application/`**: Implements the specific **use cases** of the system (e.g., `get.movies.ts`, `update.movie.ts`). It orchestrates data flow without knowing how the data is stored.
* **`infrastructure/`**: Contains the concrete implementation of external tools. Here, the **Prisma Repository** implements the interfaces defined in the domain to interact with PostgreSQL.
* **`controllers/`**: Responsible for handling HTTP requests, validating input via **DTOs**, and returning responses to the client.

### **Why this approach?**
By separating the "How" (Infrastructure) from the "What" (Domain/Application), the system becomes significantly easier to test and modify. For instance, replacing the ORM or the Database would only require a new implementation in the `infrastructure` layer, leaving the core business logic untouched.

### 🗄 Database & Seeding
The project uses PostgreSQL. To ensure the application is testable immediately upon startup:

**Automated Migrations:** Docker handles prisma migrate deploy on startup.

**Data Seeding:** A comprehensive seed script populates the database with initial movies, tracks, and songs so you can explore the workflow right away.

### Engineering Notes

**Healthchecks:** The docker-compose file includes a PostgreSQL healthcheck to prevent the Backend from starting until the database is fully ready to accept connections.

**Socket Namespacing:** The WebSocket implementation is prepared for scaling by using specific namespaces, preventing event collisions across different modules of the app.
