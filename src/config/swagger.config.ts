import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { API_PREFIX } from '@/common/constants/api.constants';

export const swaggerConfig = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Music Licensing Workflow API')
    .setDescription(
      'API for managing music licensing workflow system. This API allows you to manage movies, scenes, songs, tracks, and licenses for music licensing operations.',
    )
    .setVersion('1.0')
    .addTag('health', 'Health check endpoints')
    .addTag('movies', 'Movie management endpoints')
    .addTag('scenes', 'Scene management endpoints')
    .addTag('songs', 'Song management endpoints')
    .addTag('tracks', 'Track management endpoints')
    .addTag('licenses', 'License management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
};
