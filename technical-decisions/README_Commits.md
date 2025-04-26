# Commit Strategy Overview

This document outlines the commit structure followed throughout the implementation, to provide a clear and modular progression of the solution.  
The goal was to maintain clean, reviewable increments for each part of the system (Backend, Database, Frontend).

---

## Backend Setup

- **`setup: initial backend structure`**  
  Added basic backend configuration files: TypeScript, ESLint, Prettier, Nest CLI, and README.

- **`feat: basic server setup with NestJS`**  
  Implemented the minimum setup to start the NestJS server (`main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`).

- **`chore: add Dockerfile and docker-compose for backend`**  
  Added Dockerfile and docker-compose configuration for local development.

- **`feat: initial modules and services implementation`**  
  Added core modules, services, controllers, and entities (Movies, Scenes, Songs, Tracks, LicenseStatus).

---

## Database Setup

- Database entities were created along with backend modules.
- Database seeding scripts were included to populate initial data.
- docker-compose.yml configured the database container.

---

## Frontend Setup (Next.js)

- **`setup: initial frontend structure with Next.js`**  
  Added base Next.js configuration files: TypeScript, ESLint, README, and Next config.

- **`feat: add main pages for frontend`**  
  Added core pages (`index.tsx`, `dashboard.tsx`, dynamic `[id].tsx` pages for movies and scenes).

- **`feat: add custom hooks for frontend`**  
  Added reusable custom React hooks (`useMovies`, `useScenes`, `useTracks`).

- **`feat: add services layer for frontend`**  
  Added API service layer to fetch movies, scenes, and tracks.

- **`chore: add frontend linting config and global styles`**  
  Added global CSS and frontend-specific ESLint configuration.

- **`chore: add frontend package-lock file`**  
  Committed the `package-lock.json` for frontend dependencies consistency.

- **`chore: add static assets for frontend`**  
  Added public assets like logos, icons, and background images.

---

## Documentation

- **`docs: add technical decisions documentation`**  
  Added project documentation outlining technical decisions and architectural diagrams.

---

# Notes

- All commits were structured to keep changes atomic, small, and logically organized.
- The goal was to make code review easier and showcase a real-world professional workflow.
- The project is fully modularized, separating backend, database, and frontend concerns clearly.

