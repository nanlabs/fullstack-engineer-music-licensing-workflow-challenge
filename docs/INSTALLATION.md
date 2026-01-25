# Installation & Setup

## Prerequisites

- **Node.js** 20+ 
- **npm** or **yarn**
- **Docker** and **Docker Compose** (for containerized setup)
- **PostgreSQL** 16+ (if running locally without Docker)

## Option 1: Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd nanlabs-code-challenge
   ```

2. **Start services:**
   ```bash
   docker-compose up -d
   ```
   
   This will:
   - Start PostgreSQL database container
   - Run database migrations automatically
   - Seed the database with test data
   - Start the API server on `http://localhost:3000`

3. **Verify installation:**
   ```bash
   curl http://localhost:3000/health
   ```

4. **Access Swagger documentation:**
   Open `http://localhost:3000/docs` in your browser

## Option 2: Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in the project root:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_NAME=acme_bros_db
   DB_SYNC=false
   NODE_ENV=development
   PORT=3000
   ```

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

6. **Compile and start the development server:**
   ```bash
   npm run start:dev
   ```
   
   The server will start on `http://localhost:3000` with hot-reload enabled.

## Build for Production

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm run start:prod
   ```

## Available Scripts

| Script | Description |
|-------|-------------|
| `npm run start:dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start:prod` | Start production server |
| `npm run migration:run` | Run database migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run seed:run` | Seed database with test data |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Lint and fix code |
| `npm run lint:check` | Check for linting errors |
