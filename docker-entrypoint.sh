#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" > /dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
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
