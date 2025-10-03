import { getEntities } from '@/src/app/setup/get-entities'

export const MINIMAL_TEST_DATA_SOURCE = {
  host: process.env.TEST_HOST,
  port: Number(process.env.DB_PORT),
  type: 'postgres',
  database: 'postgres',
  username: 'testuser',
  password: 'testing',
  synchronize: false,
}

export const TEST_DATA_SOURCE = {
  ...MINIMAL_TEST_DATA_SOURCE,
  database: `db_test_${process.env.VITEST_WORKER_ID}`,
  entities: getEntities(),
  synchronize: true,
  logging: false,
}
