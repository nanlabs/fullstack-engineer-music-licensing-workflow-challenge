# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for automated testing, building, and deployment. The CI/CD pipeline ensures code quality, test coverage, and security before code is merged.

## Workflows

### 1. Main CI Pipeline (`.github/workflows/ci.yml`)

**Purpose:** Run all quality checks and tests on every push and pull request.

**Jobs:**

#### Lint
- **Purpose:** Code quality checks
- **Tools:** ESLint
- **Failure:** Blocks merge if linting errors found

#### Test
- **Purpose:** Unit tests with coverage
- **Database:** PostgreSQL 15 service container
- **Steps:**
  1. Setup Node.js and install dependencies
  2. Start PostgreSQL service
  3. Run database migrations
  4. Execute all unit tests
  5. Generate coverage reports (LCOV format)
  6. Upload coverage to Codecov
  7. Check coverage threshold (90% minimum)

#### Build
- **Purpose:** Verify application compiles
- **Steps:**
  1. Install dependencies
  2. Run `npm run build`
  3. Verify `dist/` directory exists

#### Integration Tests
- **Purpose:** End-to-end workflow tests
- **Database:** PostgreSQL 15 service container
- **Tests:** `tests/integration/workflow-edge-cases.spec.ts`
- **Verifies:**
  - Complete workflow (Movie → Scene → Song → Track → Status Update)
  - Edge cases and validation
  - Error handling

#### Security Scan
- **Purpose:** Dependency vulnerability scanning
- **Tools:** `npm audit`
- **Action:** Reports vulnerabilities, warns on moderate+

#### All Checks
- **Purpose:** Final verification
- **Requires:** All previous jobs to pass
- **Status:** Overall CI status

### 2. CodeQL Analysis (`.github/workflows/codeql.yml`)

**Purpose:** Automated security code analysis

**Features:**
- Detects security vulnerabilities in code
- Runs on push, PR, and weekly schedule
- Uses GitHub's CodeQL engine
- Supports JavaScript/TypeScript

### 3. Dependency Review (`.github/workflows/dependency-review.yml`)

**Purpose:** Review dependencies in pull requests

**Features:**
- Checks new dependencies for vulnerabilities
- Fails on moderate or higher severity
- Prevents merging vulnerable dependencies
- Runs automatically on PRs

### 4. Release (`.github/workflows/release.yml`)

**Purpose:** Automated release creation

**Triggers:**
- Push tags matching `v*.*.*` (e.g., `v1.0.0`)

**Features:**
- Builds application
- Creates GitHub release
- Includes installation instructions

### 5. Test Coverage (`.github/workflows/test-coverage.yml`)

**Purpose:** Detailed coverage reporting on PRs

**Features:**
- Generates coverage reports
- Uploads to Codecov
- Comments PR with coverage details
- Shows coverage diff

## Configuration

### Environment Variables

Set in workflow files:

```yaml
NODE_VERSION: '20.x'
POSTGRES_VERSION: '15-alpine'
POSTGRES_DB: acme_bros_db_test
POSTGRES_USER: test_user
POSTGRES_PASSWORD: test_password
```

### Test Coverage Threshold

- **Minimum:** 90%
- **Current:** 91.27% ✅
- **Enforcement:** CI fails if below threshold

### Database Setup

CI uses PostgreSQL service containers:
- Automatically started for test jobs
- Health checks ensure readiness
- Migrations run before tests
- Isolated test database

## Running Locally

### Test CI Workflow Locally

Use [act](https://github.com/nektos/act) to run workflows locally:

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow
act push

# Run specific job
act -j test

# Run with environment variables
act push -e .env.test
```

### Manual CI Steps

You can manually run CI steps locally:

```bash
# 1. Lint
npm run lint:check

# 2. Tests with coverage
npm run test:cov

# 3. Build
npm run build

# 4. Integration tests
npm test -- tests/integration/
```

## Workflow Status Badges

Add to README.md:

```markdown
![CI](https://github.com/your-org/your-repo/workflows/CI/badge.svg)
![CodeQL](https://github.com/your-org/your-repo/workflows/CodeQL%20Analysis/badge.svg)
![Test Coverage](https://codecov.io/gh/your-org/your-repo/branch/main/graph/badge.svg)
```

## Troubleshooting

### Database Connection Failures

**Symptoms:** Tests fail with database connection errors

**Solutions:**
1. Check PostgreSQL service is healthy
2. Verify environment variables
3. Check migration logs
4. Ensure `pg_isready` check passes

### Coverage Threshold Failures

**Symptoms:** CI fails with "Coverage is below 90% threshold"

**Solutions:**
1. Review coverage report in CI logs
2. Add tests for uncovered code paths
3. Check which files have low coverage
4. Focus on business logic first

### Build Failures

**Symptoms:** Build job fails

**Solutions:**
1. Check TypeScript compilation errors
2. Verify Node.js version compatibility
3. Check for missing dependencies
4. Review build logs

### Migration Failures

**Symptoms:** Database migrations fail

**Solutions:**
1. Check migration files are valid
2. Verify database connection
3. Check for conflicting migrations
4. Review migration logs

## Best Practices

1. **Run tests locally** before pushing
2. **Fix linting errors** before creating PRs
3. **Maintain test coverage** above 90%
4. **Review security scans** regularly
5. **Keep dependencies updated**
6. **Test edge cases** in integration tests
7. **Document breaking changes** in PRs

## Workflow Triggers

### Push Events
- `main` branch
- `develop` branch
- `feature/**` branches

### Pull Request Events
- PRs to `main`
- PRs to `develop`

### Manual Triggers
- Workflow dispatch (for test-coverage.yml)

### Scheduled Events
- CodeQL: Weekly on Sundays

## CI Pipeline Flow

```
Push/PR
  ↓
Lint (parallel)
  ↓
Test → Build (parallel)
  ↓
Integration Tests (parallel)
  ↓
Security Scan (parallel)
  ↓
All Checks Passed
```

## Coverage Reports

Coverage reports are available:
- **Codecov:** https://codecov.io/gh/your-org/your-repo
- **CI Artifacts:** Download from workflow runs
- **Local:** `coverage/lcov-report/index.html`

## Security

The CI pipeline includes multiple security checks:
- **CodeQL:** Static code analysis
- **Dependency Review:** New dependency scanning
- **npm audit:** Known vulnerability scanning
- **Security Headers:** Helmet middleware verification

## Performance

CI pipeline optimizations:
- **Parallel jobs:** Tests run in parallel
- **Caching:** npm dependencies cached
- **Service containers:** Database reused across jobs
- **Fast failures:** Lint runs first

## Monitoring

Monitor CI health:
- GitHub Actions tab
- Workflow run status
- Coverage trends
- Security alerts
