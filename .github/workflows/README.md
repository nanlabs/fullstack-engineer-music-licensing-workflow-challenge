# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### 1. CI Pipeline (`.github/workflows/ci.yml`)

Main continuous integration pipeline that runs on every push and pull request.

**Jobs:**
- **Lint**: Runs ESLint to check code quality
- **Test**: Runs unit tests with coverage reporting
- **Build**: Builds the application to verify compilation
- **Integration Tests**: Runs integration tests with database
- **Security Scan**: Scans dependencies for vulnerabilities
- **All Checks**: Verifies all jobs passed

**Triggers:**
- Push to `main`, `develop`, or `feature/**` branches
- Pull requests to `main` or `develop`

**Features:**
- PostgreSQL service container for database tests
- Test coverage reporting (uploaded to Codecov)
- Coverage threshold check (90% minimum)
- Parallel job execution for faster CI

### 2. CodeQL Analysis (`.github/workflows/codeql.yml`)

Security analysis using GitHub's CodeQL engine.

**Features:**
- Automated security scanning
- Detects security vulnerabilities
- Runs on push, PR, and weekly schedule

### 3. Dependency Review (`.github/workflows/dependency-review.yml`)

Reviews dependencies in pull requests for security issues.

**Features:**
- Checks new dependencies for vulnerabilities
- Fails on moderate or higher severity issues
- Runs automatically on pull requests

### 4. Release (`.github/workflows/release.yml`)

Automated release creation when version tags are pushed.

**Triggers:**
- Push tags matching `v*.*.*` pattern (e.g., `v1.0.0`)

**Features:**
- Builds application
- Creates GitHub release
- Includes installation instructions

## Environment Variables

The CI workflows use the following environment variables (set in workflow files):

- `NODE_VERSION`: Node.js version (default: 20.x)
- `POSTGRES_VERSION`: PostgreSQL version (default: 15-alpine)
- `POSTGRES_DB`: Test database name
- `POSTGRES_USER`: Test database user
- `POSTGRES_PASSWORD`: Test database password

## Test Coverage

The CI pipeline enforces a **90% test coverage threshold**. If coverage drops below 90%, the build will fail.

Current coverage: **91.27%** ✅

## Running CI Locally

You can test CI workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow
act push

# Run specific job
act -j test
```

## Badge Status

Add these badges to your README.md:

```markdown
![CI](https://github.com/your-org/your-repo/workflows/CI/badge.svg)
![CodeQL](https://github.com/your-org/your-repo/workflows/CodeQL%20Analysis/badge.svg)
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL service is healthy before running tests
- Check that environment variables are set correctly
- Verify migrations run successfully

### Coverage Threshold Failures
- Review coverage report in CI logs
- Add tests for uncovered code paths
- Current threshold: 90%

### Build Failures
- Check Node.js version compatibility
- Verify all dependencies install correctly
- Review build logs for TypeScript errors
