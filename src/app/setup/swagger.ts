import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { INestApplication } from '@nestjs/common'

const SWAGGER_NAME = 'NanLabs Challenge - Songs License Tracker'
const SWAGGER_ROOT = 'docs'
const API_VERSION = '1.3.2'

export const setupSwagger = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle(SWAGGER_NAME)
    .setDescription(
      '**Changelog URL:** [Click here](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/blob/main/CHANGELOG.md)',
    )
    .setVersion(API_VERSION)
    .build()
  const document = SwaggerModule.createDocument(app, config, {
    autoTagControllers: false,
  })
  SwaggerModule.setup(SWAGGER_ROOT, app, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NanLabs Challenge',
    swaggerOptions: {
      operationsSorter: 'method',
      persistAuthorization: true,
    },
  })
}
