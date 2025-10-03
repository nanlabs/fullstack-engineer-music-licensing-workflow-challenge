import { INestApplication } from '@nestjs/common'

export const setupCORS = (app: INestApplication) => {
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
}
