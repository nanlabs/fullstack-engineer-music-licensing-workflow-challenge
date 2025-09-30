# Music Licensing Workflow - Backend

Backend system built with NestJS to handle music licensing operations for the fictional company ACME BROS PICTURES.


### Main Entities
- Movie
- Scene
- Track
- Song
- License

### Tech Stack Decisions

**Framework** NestJS + TypeScript: Static typing (type safety), 
**Database** PostgreSQL: ACID compliance, complex queries, enum support, production-ready
**ORM** TypeORM: Strong TypeScript integration, migration system, relationship management, provides type safety
**API Style** REST + GraphQL: REST for CRUD operations, GraphQL subscriptions for real-time updates
**Real-time** GraphQL Subscriptions: great for real-time license status updates
**Containerization** Docker containers: portability, easy deploys, simplified dependency management
**Caching** Redis Performance optimization, job queue processing

## Licensing State Machine

The app implements a strict state machine for license management:

```
PENDING → IN_REVIEW → NEGOTIATING → APPROVED
    ↓         ↓            ↓           ↓
REJECTED  REJECTED    REJECTED    EXPIRED
```

**Business Rules:**
- Forward progression allowed at any stage
- Rejection possible from any active state
- Expiration only from approved status
- No backward transitions

## Setup Guide

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- npm/yarn

### Environment Setup

**Note**: The backend runs locally for development, while supporting services (PostgreSQL, Redis, Adminer) run in Docker containers.

1. **Clone and configure environment:**
```bash
git clone <repository-url>
cd music-licensing-workflow-backend
cp .env.example .env
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start Docker services** (PostgreSQL, Redis, Adminer):
```bash
docker-compose up -d
```

4. **Seed database with test data:**
```bash
npm run seed
```

5. **Start backend development server** (runs locally, not in Docker):
```bash
npm run start:dev
```

### Available Services
- **Backend API**: http://localhost:3000
- **GraphQL Playground**: http://localhost:3000/graphql
- **PostgreSQL Database Admin**: http://localhost:8081 (Adminer)
- **Swagger Documentation**: http://localhost:3000/api/docs
- **Redis**: localhost:6379 (for caching and job queues)

### Database Access (Adminer)
- **System**: PostgreSQL
- **Server**: postgres
- **Username**: postgres
- **Password**: postgres
- **Database**: music_licensing

## API Endpoints

### REST API
```
GET    /movies                           # Get all movies
GET    /movies/:id                       # Get a single movie
GET    /scenes                           # Get all scenes
GET    /scenes?movieId={id}              # Get scenes of a specific movie
GET    /tracks                           # Get all tracks
GET    /tracks?sceneId={id}              # Get tracks of a specific scene
GET    /songs                            # Get all songs
GET    /songs?search={query}             # Search songs by title/artist
GET    /licenses                         # Get all licenses
GET    /licenses/workflow-summary        # Get license counts by status
PATCH  /licenses/:id/status              # Update license status
```

### GraphQL Subscriptions

This is an example to subscribe for changes on a specific combination of trackId + status. Then, if and when the specified trackId changes to the specified Status, a message will be published.

```graphql
subscription {
  licenseStatusChanged(trackId: "uuid", status: PENDING) {
    licenseId
    trackId
    oldStatus
    newStatus
    notes
    changedAt
    trackName
    songTitle
    songArtist
    movieTitle
    sceneName
  }
}
```

## Testing

### Running Tests
```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Test Strategy
- **Unit Tests**: Service layer business logic, validation, license state transitions

### Redis Integration

The system leverages Redis (together with the Bull package) for performance optimization in 2 ways:

1. For the key endpoint /licenses/workflow-summary redis caching is implemented for 5 minutes. Without this, the endpoint would normally run a GROUP BY query every time it was called, now, it serves cached data instantly.
2. Licensing status changes Job Queue: email notifications get processed in the background by EmailProcessor (asynchronously)


#### Job Queue System
- **Email Notifications**: Background processing for license status changes
- **Retry Logic**: Exponential backoff with 3 attempts
- **Bulk Operations**: Efficient batch email processing

## Development

### Database Schema Management
- Entities use decorators for clean, declarative schema definition and simplicity/maintainability
- Migrations provide version control for database changes
- Seeding script for quick development data

### Real-time Architecture
- GraphQL subscriptions
- Event-driven license status updates
- Optimized subscription - can be filtered by track and or status
- Subscriptions contain rich event data (eliminates the need for additional API calls to get info about the song/track for example)

## Key Features

### Workflow Management
- Strict state machine enforcement
- Automatic timestamp tracking
- Validation of specified business rules

### Security
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- CORS configuration

### Scalability
- Redis caching for improved performance
- Background job processing with Bull queues
- Database connection pooling
- Horizontal scaling capability

## What could be some possible improvements for the future:

- **Authentication & Authorization**: User roles and permissions
- **Document Management**: Contract and agreement uploads
- **Advanced Analytics**: Licensing performance metrics
- **Enhanced Notifications**: Real email integration (SendGrid, AWS SES)
- **Redis Clustering**: Distributed caching for high availability (having more than one Redis node, if the master one dies, a replica becomes the new master. Ideal for a production environment where uptime is crucial.)
