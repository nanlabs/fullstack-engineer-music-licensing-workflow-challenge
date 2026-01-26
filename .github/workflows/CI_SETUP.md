# CI/CD Setup Guide

## Overview

This project uses GitHub Actions for continuous integration and deployment. The CI pipeline automatically runs tests, checks code quality, and verifies builds on every push and pull request.

## Workflows

### 1. Main CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `develop`, or `feature/**` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **Lint** - Code quality checks
   - Runs ESLint
   - Fails on linting errors

2. **Test** - Unit tests with coverage
   - Sets up PostgreSQL service container
   - Runs database migrations
   - Executes all unit tests
   - Generates coverage reports
   - Uploads coverage to Codecov
   - Checks coverage threshold (90% minimum)

3. **Build** - Application build verification
   - Compiles TypeScript
   - Verifies build artifacts

4. **Integration Tests** - End-to-end tests
   - Sets up PostgreSQL service container
   - Runs database migrations
   - Executes integration tests
   - Tests complete workflow

5. **Security Scan** - Dependency vulnerability scanning
   - Runs `npm audit`
   - Reports vulnerabilities

6. **All Checks** - Final verification
   - Ensures all jobs passed
   - Provides overall status

### 2. CodeQL Analysis (`.github/workflows/codeql.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Weekly schedule (Sundays)

**Purpose:**
- Automated security scanning
- Detects security vulnerabilities in code
- Uses GitHub's CodeQL engine

### 3. Dependency Review (`.github/workflows/dependency-review.yml`)

**Triggers:**
- Pull requests to `main` or `develop`

**Purpose:**
- Reviews new dependencies for security issues
- Fails on moderate or higher severity vulnerabilities
- Prevents merging vulnerable dependencies

### 4. Release (`.github/workflows/release.yml`)

**Triggers:**
- Push tags matching `v*.*.*` (e.g., `v1.0.0`)

**Purpose:**
- Automatically creates GitHub releases
- Builds application
- Includes installation instructions

## Setup Instructions

### 1. Enable GitHub Actions

GitHub Actions are enabled by default. No additional setup required.

### 2. Configure Secrets (Optional)

For Codecov integration, add a token (optional):

1. Go to repository Settings → Secrets and variables → Actions
2. Add new secret: `CODECOV_TOKEN`
3. Get token from https://codecov.io

**Note:** Codecov works without a token for public repositories.

### 3. Test the Pipeline

1. Push code to a branch
2. Open the "Actions" tab in GitHub
3. Watch the workflow run
4. Check results

## Environment Variables

The CI workflows use these environment variables (configured in workflow files):

```yaml
NODE_VERSION: '20.x'
POSTGRES_VERSION: '15-alpine'
POSTGRES_DB: acme_bros_db_test
POSTGRES_USER: test_user
POSTGRES_PASSWORD: test_password
```

## Test Coverage Requirements

- **Minimum Coverage:** 90%
- **Current Coverage:** 91.27% ✅
- **Enforcement:** CI fails if coverage drops below threshold

## Troubleshooting

### Database Connection Issues

If tests fail with database connection errors:

1. Check PostgreSQL service is healthy
2. Verify environment variables are set
3. Check migration logs

### Coverage Threshold Failures

If coverage check fails:

1. Review coverage report in CI logs
2. Add tests for uncovered code
3. Current threshold: 90%

### Build Failures

If build fails:

1. Check Node.js version compatibility
2. Verify TypeScript compilation
3. Review build logs for errors

## Running CI Locally

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS

# Run CI workflow
act push

# Run specific job
act -j test

# Run with specific event
act pull_request
```

## Badge Status

Add these badges to your README.md:

```markdown
![CI](https://github.com/your-org/your-repo/workflows/CI/badge.svg)
![CodeQL](https://github.com/your-org/your-repo/workflows/CodeQL%20Analysis/badge.svg)
![Test Coverage](https://codecov.io/gh/your-org/your-repo/branch/main/graph/badge.svg)
```

## Best Practices

1. **Always run tests locally** before pushing
2. **Fix linting errors** before creating PRs
3. **Maintain test coverage** above 90%
4. **Review security scans** regularly
5. **Keep dependencies updated**

## Workflow Status

Check workflow status:
- GitHub Actions tab: `https://github.com/your-org/your-repo/actions`
- Individual run: Click on any workflow run to see details
- PR checks: Shown automatically on pull requests
