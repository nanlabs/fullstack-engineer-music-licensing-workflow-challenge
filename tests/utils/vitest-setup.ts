import { PostgreSqlContainer } from '@testcontainers/postgresql'
import process from 'node:process'

export default async () => {
  console.log('Starting PostgreSql container...')

  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('testdb')
    .withUsername('testuser')
    .withPassword('testing')
    .start()

  process.env.DB_PORT = container.getMappedPort(5432).toString()
  process.env.POSTGRES_HOST = container.getHost()

  console.log('PostgreSql container started!')

  return async () => {
    await container.stop()
  }
}
