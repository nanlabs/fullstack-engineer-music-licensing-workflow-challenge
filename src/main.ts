import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify'
import { initializeTransactionalContext } from 'typeorm-transactional'
import { NestFactory } from '@nestjs/core'

import {
  getEnvVariables,
  setupFilters,
  setupSwagger,
  setupPrefix,
  setupPipes,
  setupCORS,
} from './app/setup'
import { NODE_ENVIRONMENTS, HOST } from './app/constants/api.constants'
import { AppModule } from './app/app.module'

async function bootstrap() {
  initializeTransactionalContext()
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  )

  setupCORS(app)
  setupPrefix(app)
  setupFilters(app)
  setupPipes(app)

  const { port, nodeEnv } = getEnvVariables(app)
  if (nodeEnv !== NODE_ENVIRONMENTS.PROD) {
    setupSwagger(app)
  }

  await app.listen(port, HOST)

  console.info(`App is ready and listening on port ${port} 🚀`)
}

bootstrap().catch(handleError)

function handleError(error: unknown) {
  // eslint-disable-next-line @/no-restricted-properties
  console.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleError)
