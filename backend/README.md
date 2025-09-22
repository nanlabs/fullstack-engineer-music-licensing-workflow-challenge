# Music Licensing Backend

Backend API for ACME BROS PICTURES music licensing workflow system, built with NestJS, TypeScript, and PostgreSQL.

## 🏗️ Architecture

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Real-time**: WebSocket with Socket.IO
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator and class-transformer
- **Containerization**: Docker

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker (optional)

### Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   ```bash
   cp ../env.example .env
   # Edit .env with your database credentials
   ```

3. **Start PostgreSQL** (if not using Docker)

   ```bash
   # Using Docker
   docker run --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=music_licensing -p 5432:5432 -d postgres:15-alpine
   ```

4. **Run the application**

   ```bash
   # Development mode with hot reload
   npm run start:dev

   # Production mode
   npm run build
   npm run start:prod
   ```

5. **Access the API**
   - API: http://localhost:3001/api
   - Documentation: http://localhost:3001/api/docs

### Docker Development

1. **Start all services**

   ```bash
   cd ..
   docker-compose up -d
   ```

2. **View logs**
   ```bash
   docker-compose logs -f backend
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── common/                 # Shared utilities and enums
│   │   ├── enums/             # TypeScript enums
│   │   └── gateways/          # WebSocket gateways
│   ├── database/              # Database configuration
│   ├── modules/               # Feature modules
│   │   ├── movies/            # Movie management
│   │   ├── scenes/            # Scene management
│   │   ├── songs/             # Song management
│   │   ├── tracks/            # Track management
│   │   └── licenses/          # License workflow management
│   ├── app.module.ts          # Root application module
│   └── main.ts               # Application entry point
├── test/                      # E2E tests
├── Dockerfile                 # Container configuration
└── package.json              # Dependencies and scripts
```

## 🗄️ Database Schema

The application uses the following main entities:

- **Movies**: Film projects with scenes
- **Scenes**: Individual movie scenes with tracks
- **Songs**: Music tracks with rights holder information
- **Tracks**: Song instances in scenes with timing
- **LicenseStatuses**: Workflow states for licensing process

See [Database Documentation](../docs/DATABASE.md) for detailed schema.

## 🔄 License Workflow

The licensing process follows a state machine pattern:

```
PENDING → IN_REVIEW → NEGOTIATING → APPROVED
    ↓         ↓           ↓           ↓
REJECTED ←────┴───────────┴──────→ EXPIRED
    ↓                               ↓
    └─────────→ PENDING ←──────────┘
```

### State Transitions

- **PENDING**: Initial state, can move to IN_REVIEW or REJECTED
- **IN_REVIEW**: Under review, can move to NEGOTIATING, APPROVED, REJECTED, or back to PENDING
- **NEGOTIATING**: Active negotiations, can move to APPROVED, REJECTED, or back to IN_REVIEW
- **APPROVED**: License granted, can move to EXPIRED or back to NEGOTIATING
- **REJECTED**: License denied, can move back to PENDING or IN_REVIEW
- **EXPIRED**: License expired, can move to PENDING or NEGOTIATING

## 🔌 API Endpoints

### Core Resources

- **Movies**: CRUD operations for film projects
- **Scenes**: Manage scenes within movies
- **Songs**: Music library management
- **Tracks**: Associate songs with scenes
- **Licenses**: Manage licensing workflow

### Key Features

1. **Song Creation**: Automatically initializes with PENDING license status
2. **Workflow Validation**: Enforces valid state transitions
3. **Real-time Updates**: WebSocket notifications for status changes
4. **Search**: Find songs by title, artist, or album

See [API Documentation](../docs/API.md) for complete endpoint reference.

## 🔄 Real-time Features

The application includes WebSocket implementation for real-time updates:

### Connection

```javascript
const socket = io('http://localhost:3001/license-updates');
```

### Events

- `licenseStatusUpdate`: When license status changes
- `trackCreated`: When new tracks are added
- `movieStatisticsUpdate`: When movie stats change

### Usage Example

```javascript
socket.on('licenseStatusUpdate', (data) => {
  console.log('License updated:', data);
  // Update UI with new status
});
```

> ⚠️ **Note**: WebSocket functionality has been implemented but may require additional configuration for full functionality. This was a learning area for me as real-time communication is not my primary expertise.

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚀 Deployment

### Environment Variables

| Variable       | Description           | Default                 |
| -------------- | --------------------- | ----------------------- |
| `NODE_ENV`     | Environment mode      | `development`           |
| `PORT`         | Server port           | `3001`                  |
| `DB_HOST`      | Database host         | `localhost`             |
| `DB_PORT`      | Database port         | `5432`                  |
| `DB_USERNAME`  | Database user         | `postgres`              |
| `DB_PASSWORD`  | Database password     | `password`              |
| `DB_NAME`      | Database name         | `music_licensing`       |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Production Deployment

1. **Build the application**

   ```bash
   npm run build
   ```

2. **Set production environment variables**

3. **Run database migrations** (if using TypeORM migrations)

   ```bash
   npm run migration:run
   ```

4. **Start the application**
   ```bash
   npm run start:prod
   ```

### Docker Deployment

```bash
# Build image
docker build -t music-licensing-backend .

# Run container
docker run -p 3001:3001 --env-file .env music-licensing-backend
```

## 🎯 Technical Challenges & Learning Goals

This project was designed as a technical challenge to expand my development skills in several areas:

### API Architecture Decision: REST + GraphQL

I chose to implement **both REST and GraphQL APIs** as a deliberate learning challenge:

- **REST API**: My daily expertise - familiar, cacheable, excellent for CRUD operations
- **GraphQL API**: New learning area - flexible queries, strong typing, ideal for complex relationships

This dual approach demonstrates:

- **Technical versatility**: Ability to work with different API paradigms
- **Learning mindset**: Stepping outside comfort zone to master new technologies
- **Practical flexibility**: Different clients can choose the API that best fits their needs

### CI/CD Pipeline Implementation

I implemented a **GitHub Actions CI pipeline** from scratch, which was a new area for me:

- **Automated testing**: Unit tests with database integration
- **Code quality**: ESLint and Prettier checks
- **Build validation**: TypeScript compilation verification
- **Security scanning**: Dependency vulnerability analysis

This was a significant learning experience in DevOps practices and automated workflows.

### WebSocket Real-time Communication

I implemented **WebSocket functionality** as a learning challenge:

- **Real-time updates**: License status changes, track creation notifications
- **Socket.IO integration**: Event-driven communication
- **Learning area**: Real-time communication is not my primary expertise

> ⚠️ **Note**: While the WebSocket implementation is functional, it may require additional configuration and testing for production use. This represents an area where I'm continuing to develop my skills.

## 🔧 Development

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Database Management

```bash
# Generate migration
npm run migration:generate

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### Adding New Features

1. Create module in `src/modules/`
2. Add entity with TypeORM decorators
3. Create DTOs for validation
4. Implement service with business logic
5. Add controller with endpoints
6. Register module in `app.module.ts`

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check environment variables
   - Ensure database exists

2. **Port Already in Use**
   - Change PORT environment variable
   - Kill process using port 3001

3. **WebSocket Connection Issues**
   - Check CORS configuration
   - Verify frontend URL in environment
   - Note: WebSocket functionality may require additional client-side implementation

### Debug Mode

```bash
# Start with debug logging
npm run start:debug
```

## 📋 License

This project is part of the ACME BROS PICTURES technical challenge.

## 🤝 Contributing

This is a technical challenge project that demonstrates:

### ✅ Implemented Features

- Complete REST and GraphQL API implementation
- Comprehensive unit testing (53 tests)
- CI/CD pipeline with GitHub Actions
- Docker containerization
- WebSocket real-time communication (learning implementation)
- Database schema with proper relationships
- License workflow state machine

### 🔄 Areas for Future Enhancement

- Frontend React application
- WebSocket client-side implementation and testing
- Authentication/authorization system
- Rate limiting and security hardening
- Production monitoring and logging
- Performance optimization and caching strategies

### 🎓 Learning Outcomes

This project successfully demonstrates:

- **Technical versatility**: Working with both REST and GraphQL
- **DevOps skills**: CI/CD pipeline implementation
- **Real-time communication**: WebSocket integration (learning area)
- **Testing practices**: Comprehensive unit test coverage
- **Modern architecture**: NestJS, TypeScript, PostgreSQL, Docker
