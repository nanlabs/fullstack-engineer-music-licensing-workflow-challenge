# File Structure

## 📁 Project Structure

```
nanlabs-code-challenge/
│
├── src/
│   ├── app.module.ts                    # Root application module
│   ├── main.ts                          # Application entry point
│   │
│   ├── config/                          # Configuration modules
│   │   ├── config.module.ts             # Global config module
│   │   ├── database.config.ts           # Database configuration
│   │   ├── app.config.ts                # Application configuration
│   │   └── typeorm.config.ts            # TypeORM CLI configuration
│   │
│   ├── common/                          # Shared utilities
│   │   ├── filters/                     # Exception filters
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/                # Request/response interceptors
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   └── middleware/                  # Custom middleware
│   │       └── request-id.middleware.ts
│   │
│   ├── database/                        # Database setup
│   │   ├── database.module.ts           # Database module
│   │   ├── migrations/                  # Database migrations
│   │   │   └── 1700000000000-InitialSchema.ts
│   │   └── seeds/                       # Database seeds
│   │       ├── run-seed.ts
│   │       └── seed-data.ts
│   │
│   ├── entities/                         # TypeORM entities
│   │   ├── movie.entity.ts
│   │   ├── scene.entity.ts
│   │   ├── song.entity.ts
│   │   ├── track.entity.ts
│   │   └── licensing-status.entity.ts
│   │
│   ├── health/                           # Health check module
│   │   ├── health.module.ts
│   │   ├── health.controller.ts
│   │   └── health.service.ts
│   │
│   ├── movies/                           # Movies feature module
│   │   ├── movies.module.ts
│   │   ├── movies.controller.ts
│   │   ├── movies.service.ts
│   │   └── dto/
│   │       ├── create-movie.dto.ts
│   │       └── update-movie.dto.ts
│   │
│   ├── scenes/                           # Scenes feature module
│   │   ├── scenes.module.ts
│   │   ├── scenes.controller.ts
│   │   ├── scenes.service.ts
│   │   └── dto/
│   │       ├── create-scene.dto.ts
│   │       └── update-scene.dto.ts
│   │
│   ├── songs/                            # Songs feature module
│   │   ├── songs.module.ts
│   │   ├── songs.controller.ts
│   │   ├── songs.service.ts
│   │   └── dto/
│   │       ├── create-song.dto.ts
│   │       └── update-song.dto.ts
│   │
│   ├── tracks/                            # Tracks feature module
│   │   ├── tracks.module.ts
│   │   ├── tracks.controller.ts
│   │   ├── tracks.service.ts
│   │   └── dto/
│   │       ├── create-track.dto.ts
│   │       └── update-licensing-status.dto.ts
│   │
│   └── realtime/                          # Real-time events module
│       ├── realtime.module.ts
│       ├── realtime.controller.ts
│       └── realtime.service.ts
│
├── tests/                                 # Unit tests
│   ├── common/                            # Common utilities tests
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.spec.ts
│   │   │   └── http-exception.filter.spec.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.spec.ts
│   │   │   └── transform.interceptor.spec.ts
│   │   └── middleware/
│   │       └── request-id.middleware.spec.ts
│   ├── health/
│   │   └── health.controller.spec.ts
│   ├── movies/
│   │   ├── movies.controller.spec.ts
│   │   └── movies.service.spec.ts
│   ├── scenes/
│   │   ├── scenes.controller.spec.ts
│   │   └── scenes.service.spec.ts
│   ├── songs/
│   │   ├── songs.controller.spec.ts
│   │   └── songs.service.spec.ts
│   ├── tracks/
│   │   ├── tracks.controller.spec.ts
│   │   └── tracks.service.spec.ts
│   └── realtime/
│       └── realtime.service.spec.ts
│
├── docs/                                  # Documentation
│   ├── ARCHITECTURE.md                   # Architecture and design patterns
│   ├── INSTALLATION.md                   # Installation and setup guide
│   ├── API_EXAMPLES.md                   # API testing examples with cURL
│   ├── DATABASE_SCHEMA.md                # Database schema documentation
│   ├── REALTIME_IMPLEMENTATION.md        # Real-time implementation guide
│   ├── SSE_USAGE.md                      # SSE usage guide
│   ├── TESTING.md                        # Testing guide
│   └── FILE_STRUCTURE.md                 # This file
│
├── .dockerignore
├── .eslintrc.js
├── .gitignore
├── .prettierrc
├── compose.yml                           # Docker Compose configuration
├── docker-entrypoint.sh                  # Docker entrypoint script
├── Dockerfile                            # Production Dockerfile
├── Dockerfile.dev                        # Development Dockerfile
├── nest-cli.json                         # NestJS CLI configuration
├── package.json                          # Dependencies and scripts
└── tsconfig.json                         # TypeScript configuration
```

## Module Structure Pattern

Each feature module follows this structure:

```
feature-name/
├── feature-name.module.ts        # Module definition
├── feature-name.controller.ts    # REST endpoints
├── feature-name.service.ts       # Business logic
└── dto/                          # Data Transfer Objects
    ├── create-feature-name.dto.ts
    └── update-feature-name.dto.ts
```

**Note:** Unit tests are located in the `tests/` folder at the project root, maintaining the same directory structure as `src/`.

## Directory Descriptions

### `/src` - Source Code

- **`app.module.ts`**: Root NestJS module that imports all feature modules
- **`main.ts`**: Application entry point, configures middleware, pipes, and starts the server

#### `/src/config` - Configuration
- Centralized configuration using `@nestjs/config`
- Database configuration with TypeORM
- Application settings (port, environment, CORS)

#### `/src/common` - Shared Utilities
- **`filters/`**: Global exception filters for error handling
- **`interceptors/`**: Request/response interceptors for logging and transformation
- **`middleware/`**: Custom middleware (e.g., request ID generation)

#### `/src/database` - Database Setup
- **`migrations/`**: TypeORM database migrations
- **`seeds/`**: Database seeding scripts for test data

#### `/src/entities` - TypeORM Entities
- Database entity definitions
- Relationships and constraints
- Enum definitions (e.g., `LicensingState`)

#### `/src/health` - Health Checks
- Health check endpoints using `@nestjs/terminus`
- Database, memory, and disk health monitoring

#### `/src/movies` - Movies Module
- CRUD operations for movies
- Movie management endpoints

#### `/src/scenes` - Scenes Module
- CRUD operations for scenes
- Scene filtering by movie
- Validation (endTime > startTime)

#### `/src/songs` - Songs Module
- CRUD operations for songs
- Song management endpoints

#### `/src/tracks` - Tracks Module
- CRUD operations for tracks
- Licensing status management
- Track filtering by scene/movie
- Transaction-based operations

#### `/src/realtime` - Real-Time Events Module
- Server-Sent Events (SSE) implementation
- Real-time event streaming
- Event filtering capabilities

### `/tests` - Unit Tests

All unit tests are organized in the `tests/` folder, mirroring the `src/` directory structure:

- **Feature tests**: Controller and service tests for each module
- **Common tests**: Tests for filters, interceptors, and middleware
- **Realtime tests**: Tests for SSE functionality

### `/docs` - Documentation

- **`ARCHITECTURE.md`**: System architecture, design patterns, and tech stack
- **`INSTALLATION.md`**: Detailed installation instructions and available scripts
- **`API_EXAMPLES.md`**: Complete cURL examples for all API endpoints
- **`DATABASE_SCHEMA.md`**: Complete database schema documentation
- **`REALTIME_IMPLEMENTATION.md`**: Real-time implementation guide and recommendations
- **`SSE_USAGE.md`**: SSE usage guide with client examples
- **`TESTING.md`**: Testing guide and best practices
- **`FILE_STRUCTURE.md`**: This file - project structure documentation

## Key Files

### Configuration Files

- **`package.json`**: Dependencies and npm scripts
- **`tsconfig.json`**: TypeScript configuration
- **`nest-cli.json`**: NestJS CLI configuration
- **`.eslintrc.js`**: ESLint configuration
- **`.prettierrc`**: Prettier formatting configuration

### Docker Files

- **`Dockerfile`**: Production Docker image
- **`Dockerfile.dev`**: Development Docker image
- **`compose.yml`**: Docker Compose configuration
- **`docker-entrypoint.sh`**: Docker entrypoint script

### Other Files

- **`.gitignore`**: Git ignore rules
- **`.dockerignore`**: Docker ignore rules
- **`LICENSE`**: Project license

## Test Organization

Tests are organized separately from source code:

- **Location**: `tests/` folder at project root
- **Structure**: Mirrors `src/` directory structure
- **Naming**: `*.spec.ts` files
- **Coverage**: All services, controllers, filters, interceptors, middleware, and utilities have tests

## Documentation Organization

All documentation is centralized in the `docs/` folder:

- **Database Schema**: Entity relationships and field descriptions
- **Real-Time Implementation**: SSE implementation details
- **SSE Usage**: Client integration examples
- **File Structure**: This document
