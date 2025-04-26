# 🎸 Fullstack Engineer Challenge – Music Licensing Workflow

> **Developed by Alan Garcilazo**

This project was built as part of a technical challenge for **ACME BROS PICTURES**. It features a fullstack system to manage music licensing across movie scenes, with real-time license status updates.

---

## 🚀 Tech Stack

| Layer         | Technology                                         | Purpose                                                                 |
|---------------|----------------------------------------------------|-------------------------------------------------------------------------|
| 🖥️ Frontend    | [Next.js](https://nextjs.org/), React, Tailwind CSS | Fast UI development with component reuse and dynamic routing            |
| ⚙️ Backend     | [NestJS](https://nestjs.com/) (TypeScript)         | Modular REST + WebSocket support, maintainable architecture             |
| 🧠 Database    | PostgreSQL + TypeORM                               | Strong relational schema, strict typing, and constraint enforcement     |
| 🔄 Real-Time   | WebSocket (socket.io)                              | Real-time license status updates across clients                         |
| 📦 DevOps      | Docker + Docker Compose                            | Consistent local environments and multi-service orchestration           |

---

## 📂 Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── movie/
│   │   ├── scene/
│   │   ├── track/
│   │   ├── song/
│   │   └── license-status/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── services/
│   └── Dockerfile
├── compose.yml
└── README.md
```

---

## ⚙️ Core Features

- 🎬 Manage movies and scenes
- 🎧 Assign songs to tracks with start/end timestamps
- 🟢 Track and change license statuses in real-time
- 🧠 Database model includes Movies, Scenes, Songs, Tracks, LicenseStatus
- 🔁 Real-time synchronization using WebSocket

---

## 🔗 API Endpoints

### 🎬 Movies
- `GET /movie`
- `POST /movie`

### 🎞️ Scenes
- `GET /scene`
- `POST /scene`

### 🎵 Songs
- `GET /song`
- `POST /song`

### 🎧 Tracks
- `GET /track`
- `POST /track`

### 🟢 License Status
- `GET /license-status/`

---

## 🛠️ Running Locally

### Requirements:
- Docker + Docker Compose

### Instructions:

```bash
# Clone the repository
git clone https://github.com/your-user/fullstack-engineer-music-licensing-workflow-challenge.git
cd fullstack-engineer-music-licensing-workflow-challenge

# Start services
docker-compose up --build
```

- Frontend: http://localhost:3001  
- Backend: http://localhost:3000

---

## 🗃️ Seeding the Database

After starting all services, you can populate initial test data using the seed script:

```bash
# Enter the backend container
docker exec -it <backend_container_name> sh

# Run the seed script
npm run seed

# Install dependencies
npm install (frontend)
```

This will populate Movies, Scenes, Songs, Tracks, and LicenseStatus tables.

---

## 📡 Real-Time Feature

Every time a license status is updated, a WebSocket event is emitted.  
All clients receive the update instantly.

---

## ✅ Manual Test Flow

1. Open the app in two tabs.
2. Navigate to the same scene.
3. Change a track's license status in one tab.
4. The other tab updates in real time.

---

## 🧠 Technical Decisions

- **NestJS** for modularity, WebSocket support and clean architecture
- **PostgreSQL + TypeORM** for relational modeling and constraint enforcement
- **Next.js + React** for fast frontend development with routing
- **WebSocket** for real-time updates with low overhead
- **Docker** for consistent environments

---

## 📊 Architecture

View Architecture Diagram.png


---

## 🔧 Improvements Pending Based on Business Model Scope

The following enhancements were identified as future work:

- ✅ Add user authentication.
- ✅ Audit logs for license changes
- ✅ Pagination and filters
- ✅ Unit + integration testing (Jest, Supertest)
- ✅ UI polish across screen sizes

---

## 👨‍💻 Author

**Alan Garcilazo**  
Fullstack Developer focused on secure, scalable and elegant solutions.  
[LinkedIn](https://www.linkedin.com/in/alangarcilazo/) | [GitHub](https://github.com/alangarcilazo)

---

> Thank you for reviewing this challenge submission 🙌