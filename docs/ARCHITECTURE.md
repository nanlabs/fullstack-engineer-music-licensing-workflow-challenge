# Architecture & Design

## Overview

The ACME BROS API is built using **NestJS**, a progressive Node.js framework that provides:
- **Modular Architecture**: Feature-based modules (Movies, Scenes, Songs, Tracks)
- **Dependency Injection**: Loose coupling and easy testing
- **Type Safety**: Full TypeScript support
- **Database ORM**: TypeORM for PostgreSQL with migrations and seeding

## Key Features

### 🎯 Core Functionality
- **CRUD Operations**: Complete REST API for Movies, Scenes, Songs, and Tracks
- **Licensing Management**: Track licensing status with full history
- **Status Workflow**: State machine for licensing states (pending → negotiating → approved/rejected/expired)
- **Real-Time Updates**: Server-Sent Events (SSE) for live licensing status updates

### 🛡️ Production-Ready Features
- **Configuration Management**: Centralized config with `@nestjs/config`
- **Health Checks**: Database, memory, and disk monitoring via `@nestjs/terminus`
- **Rate Limiting**: DDoS protection with `@nestjs/throttler` (100 req/min)
- **Security Headers**: Helmet middleware for XSS/CSRF protection
- **Error Handling**: Global exception filters with standardized error responses
- **Request Logging**: Comprehensive request/response logging with performance metrics
- **Response Transformation**: Standardized API response format
- **Request Tracking**: Unique request IDs for correlation
- **Compression**: Response compression for better performance

### 📊 Design Patterns
- **Repository Pattern**: TypeORM repositories for data access
- **DTO Pattern**: Data Transfer Objects for validation and transformation
- **Module Pattern**: Feature-based modules with clear boundaries
- **Observer Pattern**: Real-time event streaming with RxJS Observables

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16
- **ORM**: TypeORM 0.3.x
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest

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
