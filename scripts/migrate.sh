#!/bin/sh
MIGRATION_NAME=${1:-migration}
npx typeorm-ts-node-commonjs migration:generate -d src/db/datasource.ts "src/db/migrations/${MIGRATION_NAME}"