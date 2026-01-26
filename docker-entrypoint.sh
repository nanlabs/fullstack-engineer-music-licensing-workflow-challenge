#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" > /dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    echo "PostgreSQL failed to become ready after $MAX_ATTEMPTS attempts (60 seconds)"
    exit 1
  fi
  echo "PostgreSQL is unavailable - sleeping (attempt $ATTEMPT/$MAX_ATTEMPTS)"
  sleep 2
done

echo "PostgreSQL is ready - running migrations..."
if ! npm run migration:run; then
  echo "Migration failed!"
  exit 1
fi

# Only run seeds in non-production environments
if [ "$NODE_ENV" != "production" ]; then
  echo "Running seed data..."
  npm run seed:run
else
  echo "Skipping seed data in production environment"
fi

echo "Starting application..."
if [ "$NODE_ENV" = "production" ]; then
  exec npm run start:prod
else
  exec npm run start:dev
fi
