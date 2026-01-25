# 🚀 ACME BROS Music Licensing Workflow API

A comprehensive REST API for managing music licensing workflows in movie production, built with NestJS, TypeScript, PostgreSQL, and TypeORM.

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** 20+ 
- **npm** or **yarn**
- **Docker** and **Docker Compose** (for containerized setup)
- **PostgreSQL** 16+ (if running locally without Docker)

### Option 1: Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd nanlabs-code-challenge
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file and update values as needed (see [Environment Variables](#environment-variables) section).

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```
   
   This will:
   - Start PostgreSQL database container
   - Run database migrations automatically
   - Seed the database with test data
   - Start the API server on `http://localhost:3000`

4. **Verify installation:**
   ```bash
   curl http://localhost:3000/api/health
   ```

5. **Access Swagger documentation:**
   Open `http://localhost:3000/api/docs` in your browser

### Option 2: Local Development Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd nanlabs-code-challenge
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration. The `.env.example` file contains all available variables with detailed documentation. Below is the complete list of all environment variables:
   
   **Required for basic setup:**
   ```env
   # Application Configuration
   PORT=3000
   NODE_ENV=development
   API_PREFIX=api
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_NAME=acme_bros_db
   DB_SYNC=false
   ```
   
   **All available optional variables (with defaults):**
   ```env
   # CORS Configuration
   CORS_ENABLED=true
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   
   # Database Connection Pool Configuration
   DB_POOL_MAX=20
   DB_POOL_MIN=5
   DB_POOL_IDLE_TIMEOUT=30000
   DB_POOL_CONNECTION_TIMEOUT=2000
   
   # Rate Limiting Configuration
   RATE_LIMIT_TTL=60000
   RATE_LIMIT_MAX=100
   
   # Pagination Configuration
   PAGINATION_DEFAULT_PAGE=1
   PAGINATION_DEFAULT_LIMIT=10
   PAGINATION_MAX_LIMIT=100
   
   # Health Check Configuration
   HEALTH_CHECK_MEMORY_HEAP_THRESHOLD=157286400
   HEALTH_CHECK_MEMORY_RSS_THRESHOLD=157286400
   HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD=314572800
   HEALTH_CHECK_DISK_THRESHOLD_PERCENT=0.9
   
   # Server-Sent Events (SSE) Configuration
   SSE_HEARTBEAT_INTERVAL=30000
   SSE_MAX_CONNECTIONS=1000
   
   # Request Configuration
   REQUEST_TIMEOUT=30000
   REQUEST_BODY_SIZE_LIMIT=10mb
   
   # Transform Interceptor Configuration
   TRANSFORM_INTERCEPTOR_SKIP_PATHS=/health,/docs
   TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES=204
   ```
   
   **Quick Start:** For local development, you only need to configure the required variables above. All optional variables have sensible defaults and can be left as-is or customized later. See `.env.example` for detailed documentation of each variable including descriptions, units, and production recommendations.

3. **Start PostgreSQL:**
   
   Using Docker:
   ```bash
   docker run -d \
     --name acme-bros-postgres \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=acme_bros_db \
     -p 5432:5432 \
     postgres:16-alpine
   ```
   
   Or use your local PostgreSQL instance.

4. **Run database migrations:**
   ```bash
   npm run migration:run
   ```

5. **Seed the database:**
   ```bash
   npm run seed:run
   ```

6. **Start development server:**
   ```bash
   npm run start:dev
   ```
   
   The server will start on `http://localhost:3000` with hot-reload enabled.

### Environment Variables

All configuration is managed through environment variables. The `.env.example` file contains all available options with documentation. Here's a quick reference:

**Required Variables (for local development):**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment: development, production, test
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USERNAME` - Database username (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `DB_NAME` - Database name (default: acme_bros_db)

**Optional Variables (have sensible defaults):**

*Application Configuration:*
- `API_PREFIX` - API route prefix (default: api)
- `CORS_ENABLED` - Enable CORS (default: true)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated, default: http://localhost:3000,http://localhost:3001)

*Database Connection Pool:*
- `DB_POOL_MAX` - Max database connections (default: 20)
- `DB_POOL_MIN` - Min database connections (default: 5)
- `DB_POOL_IDLE_TIMEOUT` - Idle timeout in ms (default: 30000)
- `DB_POOL_CONNECTION_TIMEOUT` - Connection timeout in ms (default: 2000)
- `DB_SYNC` - Enable database sync in development (default: false, ⚠️ never use in production)

*Rate Limiting:*
- `RATE_LIMIT_TTL` - Rate limit window in ms (default: 60000)
- `RATE_LIMIT_MAX` - Max requests per window (default: 100)

*Pagination:*
- `PAGINATION_DEFAULT_PAGE` - Default page number (default: 1)
- `PAGINATION_DEFAULT_LIMIT` - Default items per page (default: 10)
- `PAGINATION_MAX_LIMIT` - Max items per page (default: 100)

*Health Check:*
- `HEALTH_CHECK_MEMORY_HEAP_THRESHOLD` - Memory heap threshold in bytes (default: 157286400 = 150MB)
- `HEALTH_CHECK_MEMORY_RSS_THRESHOLD` - Memory RSS threshold in bytes (default: 157286400 = 150MB)
- `HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD` - Liveness memory threshold in bytes (default: 314572800 = 300MB)
- `HEALTH_CHECK_DISK_THRESHOLD_PERCENT` - Disk usage threshold as decimal (default: 0.9 = 90%)

*Server-Sent Events & Timeouts:*
- `SSE_HEARTBEAT_INTERVAL` - SSE heartbeat interval in ms (default: 30000)
- `SSE_MAX_CONNECTIONS` - Maximum concurrent SSE connections (default: 1000)
- `REQUEST_TIMEOUT` - Request timeout in ms (default: 30000)
- `REQUEST_BODY_SIZE_LIMIT` - Maximum request body size (default: 10mb)

*Transform Interceptor:*
- `TRANSFORM_INTERCEPTOR_SKIP_PATHS` - Comma-separated paths to skip transformation (default: /health,/docs)
- `TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES` - Comma-separated status codes to skip (default: 204)

**Note:** The `.env.example` file contains all variables with detailed documentation, descriptions, and production recommendations. Copy it to `.env` and customize as needed.

**Important:** 
- Copy `.env.example` to `.env` and customize as needed
- Never commit `.env` files to version control (already in `.gitignore`)
- For production, ensure all sensitive values are properly configured
- See `.env.example` for detailed documentation of each variable

## 📚 Documentation

All project documentation is available in the [`docs/`](./docs/) folder:

- **[Architecture & Design](./docs/ARCHITECTURE.md)** - System architecture, design patterns, and tech stack
- **[Installation & Setup](./docs/INSTALLATION.md)** - Detailed installation instructions and available scripts
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - Entity relationships, licensing states, and field descriptions
- **[File Structure](./docs/FILE_STRUCTURE.md)** - Complete project structure and module organization
- **[API Examples](./docs/API_EXAMPLES.md)** - Complete cURL examples for all endpoints
- **[Real-Time Implementation](./docs/REALTIME_IMPLEMENTATION.md)** - SSE implementation guide and recommendations
- **[SSE Usage Guide](./docs/SSE_USAGE.md)** - Client integration examples for Server-Sent Events
- **[Testing](./docs/TESTING.md)** - Testing guide and best practices

## 🎯 Key Features

- **CRUD Operations** - Complete REST API for Movies, Scenes, Songs, and Tracks
- **Licensing Management** - Track licensing status with full history
- **Real-Time Updates** - Server-Sent Events (SSE) for live licensing status updates
- **Production-Ready** - Health checks, rate limiting, security headers, error handling
- **Comprehensive Testing** - Unit tests with Jest
- **API Documentation** - Interactive Swagger/OpenAPI documentation

## 🛠️ Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16
- **ORM**: TypeORM 0.3.x
- **Testing**: Jest
- **API Style**: REST API with Server-Sent Events (SSE) for real-time updates

## 🎯 Tech Decisions & Tradeoffs

### Why REST API?

This project uses **REST API** instead of GraphQL for the following reasons:

#### ✅ Advantages of REST for This Use Case

1. **Simplicity & Familiarity**
   - REST follows standard HTTP conventions that are widely understood
   - Easier onboarding for developers familiar with HTTP methods
   - Straightforward caching strategies using HTTP cache headers

2. **Clear Resource-Based Model**
   - The domain (Movies, Scenes, Songs, Tracks) maps naturally to REST resources
   - CRUD operations align perfectly with HTTP verbs (GET, POST, PATCH, DELETE)
   - Predictable URL structure: `/api/movies`, `/api/movies/:id/scenes`

3. **Performance & Efficiency**
   - No query parsing overhead (GraphQL requires parsing and validation)
   - Simpler request/response cycle for standard CRUD operations
   - Better suited for bulk operations and pagination

4. **Tooling & Ecosystem**
   - Excellent Swagger/OpenAPI support for automatic documentation
   - Standard HTTP caching mechanisms work out of the box
   - Better integration with CDNs and reverse proxies
   - Simpler debugging with standard HTTP tools (curl, Postman, browser dev tools)

5. **Real-Time Requirements**
   - Server-Sent Events (SSE) integrates seamlessly with REST endpoints
   - No need for GraphQL subscriptions when SSE provides simpler real-time updates
   - Lower complexity for one-way real-time data streaming

6. **Team & Project Size**
   - REST is sufficient for the current feature set
   - Lower learning curve for team members
   - Faster development iteration without GraphQL schema management

#### ⚠️ Tradeoffs Considered

**What We Gave Up:**
- **Flexible Queries**: Clients can't request exactly the fields they need (though pagination helps)
- **Single Endpoint**: Multiple endpoints instead of one GraphQL endpoint
- **Type Safety**: Less compile-time type safety between client and server

**Why It's Acceptable:**
- The domain model is relatively simple and stable
- Most queries follow standard patterns (list, get by ID, filter)
- The benefits of simplicity outweigh the flexibility cost
- Type safety is maintained through TypeScript and DTOs on the server side

### When GraphQL Would Make Sense

GraphQL would be a better choice if:
- Clients need highly flexible, ad-hoc queries
- Multiple client applications with different data requirements
- Complex nested relationships requiring multiple round trips
- Need for real-time subscriptions with complex filtering
- Large team with dedicated GraphQL expertise

### Other Tech Decisions

#### NestJS Framework
- **Why**: Enterprise-grade structure, TypeScript-first, excellent decorator support
- **Tradeoff**: Steeper learning curve vs Express, but better long-term maintainability

#### TypeORM
- **Why**: TypeScript support, migrations, active record pattern
- **Tradeoff**: Slightly heavier than Prisma, but better integration with NestJS

#### PostgreSQL
- **Why**: ACID compliance, JSON support, mature ecosystem
- **Tradeoff**: More complex setup than MongoDB, but better data integrity

#### Server-Sent Events (SSE) vs WebSockets
- **Why**: Simpler implementation, one-way server-to-client streaming is sufficient
- **Tradeoff**: No bidirectional communication, but licensing status updates are unidirectional

#### TypeScript Strict Mode
- **Why**: Better type safety, catches errors at compile time
- **Tradeoff**: More verbose code, but significantly reduces runtime errors

## 📋 Available Scripts

| Script | Description |
|-------|-------------|
| `npm run start:dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start:prod` | Start production server |
| `npm test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run migration:run` | Run database migrations |
| `npm run seed:run` | Seed database with test data |

See [Installation Guide](./docs/INSTALLATION.md) for complete list of scripts.

## 🔗 Quick Links

- **Swagger Documentation**: `http://localhost:3000/api/docs`
- **Health Checks**: `http://localhost:3000/api/health`
- **Real-Time Events**: `http://localhost:3000/api/realtime/events`

**Note**: All endpoints are prefixed with `/api` by default (configurable via `API_PREFIX` environment variable).

## 🏗️ Architecture Highlights

### API Design Philosophy

- **RESTful Principles**: Resources map to URLs, HTTP methods indicate actions
- **Consistent Response Format**: All responses follow a standardized structure with `success`, `data`, and `meta` fields
- **Pagination**: All list endpoints support pagination with configurable limits
- **Real-Time Updates**: SSE streams for licensing status changes
- **Comprehensive Validation**: Input validation using DTOs with class-validator
- **Error Handling**: Standardized error responses with appropriate HTTP status codes

### Key Design Patterns

- **Repository Pattern**: Data access abstraction through TypeORM repositories
- **DTO Pattern**: Data Transfer Objects for validation and API contracts
- **Module Pattern**: Feature-based modules with clear boundaries
- **Observer Pattern**: Real-time event streaming with RxJS Observables
- **Dependency Injection**: Loose coupling through NestJS DI container

### Security Features

- **Rate Limiting**: Configurable rate limits to prevent abuse
- **CORS**: Configurable allowed origins for cross-origin requests
- **Security Headers**: Helmet middleware for XSS/CSRF protection
- **Input Validation**: Strict validation on all inputs
- **UUID Validation**: All ID parameters validated as UUIDs
- **Request Timeout**: Configurable timeout to prevent resource exhaustion

### Performance Optimizations

- **Connection Pooling**: Configurable database connection pool
- **Response Compression**: Gzip compression for responses
- **Pagination**: Prevents large dataset queries
- **Efficient Queries**: Optimized TypeORM queries with proper relations
- **Indexing**: Database indexes on foreign keys and frequently queried fields

## 📝 License

See `LICENSE` file for details.
