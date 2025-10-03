# Movie Track Licensing API

API for managing track licensing. Built with NestJS, TypeORM, and PostgreSQL.

[Changelog](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/blob/main/CHANGELOG.md)

## Setup Instructions

### Prerequisites

- Docker installed
- Environment variables configured (see `.env.example`)

### Installation

```bash
git clone https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge
cd fullstack-engineer-music-licensing-workflow-challenge
cp env.example ./.env
docker-compose up -d --build
```

### Running test suite

- Install dependencies first (`npm i`) if you haven't.

```bash
npm run test:e2e
```

Tests are made following some guidelines seen in: <https://github.com/goldbergyoni/nodejs-testing-best-practices>

---

## Tech Requirements

- **Backend:** You can use any stack you're comfortable with, but we recommend using any of the following:
  - [x] TypeScript + NestJS (you can use Fastify or Koa if you prefer)
  - [ ] Python + FastAPI (you can use Flask or Django if you prefer)
  - [ ] Go + Fiber (you can use Gin or Echo if you prefer)

- **Containerization:**
  - [x] Docker (required)

---

## Deliverables

- [x] A **backend** exposing the required APIs.
- [x] A **data model** to manage:
  - Movies, scenes, tracks, songs, and their licensing states.

- Endpoints or queries/mutations to:
  - [x] Create a track and associate a song.
  - [x] Update the licensing state of a track.
  - [x] Query all tracks for a given scene/movie, including licensing status.

- [x] Suggest a real-time implementation using WebSockets, GraphQL Subscriptions, or Server-Sent Events. -[x] Docker setup to run the entire app locally.
- [x] A `README.md` with:
  - [x] Setup instructions
  - [x] Tech decisions and tradeoffs
  - [x] If applicable, your reasoning for using REST, GraphQL, or both

---

## Assumptions

- Scenes don't require timestamps, it would be easy to implement but it would overcomplicate the challenge taking more time implementing basically the same logic that I already implemented with the tracks timestamps.

- CRUD operations for each entity were not required explicitly, so I didn't implement them. It would just take more time and they would basically prove nothing. The required endpoints are all implemented and tested.

---

## Extras

- I included a Swagger instance on <http://localhost:PORT/docs> since I wasn't required to make a frontend, but I wanted to make sure that whoever is reading this was going to be able to spin up the project in docker and be able to interact with it without a frontend.

- I included a license-history feature that lets you track each change in licenses status for better traceablity.

- Added a script to automatically create a changelog and bump the tags version, as well as the package-json version with git-cliff and a basic shell script.

- Added Lefthook to keep git commit linted. It also runs the linter and the tests on push to prevent broken releases.

---

## Tech decisions and tradeoffs

- At some point I considered using postgres intervals for the timestamps but TypeORM is really buggy when interacting with intervals so I ultimately decided to ditch the idea and store timestamps as seconds.

- I decided to implement the entire challenge in NestJS because it was mentioned in the invitation email as the tech stack and I already had a somehow scaffolded project that I could use to save time. If I had more time available would implement this with DrizzleORM because i prefer it over TypeORM. TypeORM is considered abandonedware by today standards and its not a good package.

- I implemented e2e tests with testcontainers to test the core logic of the application, this makes it a bit slow (each test suite has to spin up a temporal container and migrate the db). If I had more time I would just test it against a single db saving up time and resources, but since the app isnt that big its not a big deal.

- I chose to implement a SSE endpoint for the sake of simplicity and because I considered that a Websocket was too much for just updating licenses status. It returns the updated license and its documented in Swagger.

- I chose to only implement REST endpoint again for the sake of simplicity and also because I could make a good documentation with OpenAPI standards.

---

## Features

- Music licensing workflow
- SSE endpoint to update licenses status in real time
- Automatic API documentation with Swagger
- PostgreSQL containerized with Docker
- Initial database population via SQL scripts

---

## Technologies

- Node.js / TypeScript
- NestJS (Fastify adapter)
- TypeORM
- PostgreSQL 16
- Docker / Docker Compose
- Swagger (`@nestjs/swagger`) for API documentation

---

## Endpoints

### Health

- **GET** `/api/health`  
  Health Check

### Movies

- **GET** `/api/movies/{id}`  
  Retrieves a movie with its details by ID

- **GET** `/api/movies`  
  Retrieves all movies

### Tracks

- **POST** `/api/tracks`  
  Creates a track and associates it to a song

### Licenses

- **GET** `/api/licenses/status/stream`  
  Subscribe to license status changes (Swagger Try Out is not supported)

- **PATCH** `/api/licenses/{id}/status`  
  Update License Status

---

## Tests coverage

```
----------------------------------------------------|---------|----------|---------|---------|-------------------
File                                                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------------------------------------|---------|----------|---------|---------|-------------------
All files                                           |   99.47 |      100 |    98.3 |   99.47 |
 license-history/domain                             |     100 |      100 |     100 |     100 |
  license-history.repository.ts                     |     100 |      100 |     100 |     100 |
 license-history/repositories                       |     100 |      100 |     100 |     100 |
  license-history.module.ts                         |     100 |      100 |     100 |     100 |
  license-history.repository.ts                     |     100 |      100 |     100 |     100 |
 licenses/application                               |     100 |      100 |     100 |     100 |
  licenses.module.ts                                |     100 |      100 |     100 |     100 |
  licenses.service.ts                               |     100 |      100 |     100 |     100 |
 licenses/domain                                    |     100 |      100 |     100 |     100 |
  licenses.repository.ts                            |     100 |      100 |     100 |     100 |
 licenses/infrastructure/controllers                |    94.8 |      100 |      75 |    94.8 |
  licenses.controller.ts                            |    94.8 |      100 |      75 |    94.8 | 98-101
 licenses/infrastructure/controllers/dtos/requests  |     100 |      100 |     100 |     100 |
  update-license-params.requests.dto.ts             |     100 |      100 |     100 |     100 |
  update-license-status.dto.ts                      |     100 |      100 |     100 |     100 |
 licenses/infrastructure/controllers/dtos/responses |     100 |      100 |     100 |     100 |
  update-license.dto.ts                             |     100 |      100 |     100 |     100 |
 licenses/infrastructure/repositories               |     100 |      100 |     100 |     100 |
  licenses.module.ts                                |     100 |      100 |     100 |     100 |
  licenses.repository.ts                            |     100 |      100 |     100 |     100 |
 movies/application                                 |     100 |      100 |     100 |     100 |
  movies.module.ts                                  |     100 |      100 |     100 |     100 |
  movies.service.ts                                 |     100 |      100 |     100 |     100 |
 movies/domain                                      |     100 |      100 |     100 |     100 |
  movies.repository.ts                              |     100 |      100 |     100 |     100 |
 movies/infrastructure/controllers                  |     100 |      100 |     100 |     100 |
  movies.controller.ts                              |     100 |      100 |     100 |     100 |
 movies/infrastructure/controllers/dtos/requests    |     100 |      100 |     100 |     100 |
  get-movie-by-id.dto.ts                            |     100 |      100 |     100 |     100 |
 movies/infrastructure/controllers/dtos/responses   |     100 |      100 |     100 |     100 |
  get-movies.response.dto.ts                        |     100 |      100 |     100 |     100 |
  movie-by-id.dto.ts                                |     100 |      100 |     100 |     100 |
 movies/infrastructure/repositories                 |     100 |      100 |     100 |     100 |
  movies.module.ts                                  |     100 |      100 |     100 |     100 |
  movies.repository.ts                              |     100 |      100 |     100 |     100 |
 scenes/domain                                      |     100 |      100 |     100 |     100 |
  scenes.repository.ts                              |     100 |      100 |     100 |     100 |
 scenes/infrastructure/repositories                 |     100 |      100 |     100 |     100 |
  scenes.module.ts                                  |     100 |      100 |     100 |     100 |
  scenes.repository.ts                              |     100 |      100 |     100 |     100 |
 songs/domain                                       |     100 |      100 |     100 |     100 |
  songs.repository.ts                               |     100 |      100 |     100 |     100 |
 songs/infrastructure/repositories                  |     100 |      100 |     100 |     100 |
  songs.module.ts                                   |     100 |      100 |     100 |     100 |
  songs.repository.ts                               |     100 |      100 |     100 |     100 |
 tracks/application                                 |     100 |      100 |     100 |     100 |
  tracks-module.ts                                  |     100 |      100 |     100 |     100 |
  tracks-service.ts                                 |     100 |      100 |     100 |     100 |
 tracks/domain                                      |     100 |      100 |     100 |     100 |
  tracks.repository.ts                              |     100 |      100 |     100 |     100 |
 tracks/infrastructure/controllers                  |     100 |      100 |     100 |     100 |
  tracks.controller.ts                              |     100 |      100 |     100 |     100 |
 tracks/infrastructure/controllers/dtos/requests    |     100 |      100 |     100 |     100 |
  create-track.request.dto.ts                       |     100 |      100 |     100 |     100 |
 tracks/infrastructure/controllers/dtos/responses   |     100 |      100 |     100 |     100 |
  create-track.response.dto.ts                      |     100 |      100 |     100 |     100 |
 tracks/infrastructure/repositories                 |     100 |      100 |     100 |     100 |
  tracks.module.ts                                  |     100 |      100 |     100 |     100 |
  tracks.repository.ts                              |     100 |      100 |     100 |     100 |
----------------------------------------------------|---------|----------|---------|---------|-------------------
```
