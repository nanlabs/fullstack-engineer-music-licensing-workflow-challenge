import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Get configuration service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  const bodySizeLimit =
    configService.get<string>('app.requestBodySizeLimit') || '10mb';

  // Configure body parser limits
  // NestJS uses Express under the hood, access via getHttpAdapter
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.json({ limit: bodySizeLimit }));
  expressApp.use(express.urlencoded({ extended: true, limit: bodySizeLimit }));

  // Set global API prefix
  app.setGlobalPrefix(apiPrefix);

  // Security headers
  app.use(helmet.default());

  // Compression middleware
  app.use(compression());

  // Enable CORS
  if (configService.get<boolean>('app.corsEnabled') !== false) {
    const configuredOrigins = configService.get<string[]>('app.allowedOrigins');
    let allowedOrigins: string[] | false;

    if (nodeEnv === 'production') {
      // In production, require explicit origin configuration
      // If not configured, CORS is disabled for security
      allowedOrigins =
        configuredOrigins && configuredOrigins.length > 0
          ? configuredOrigins
          : false;
    } else {
      // In development, use configured origins or default to localhost
      allowedOrigins =
        configuredOrigins && configuredOrigins.length > 0
          ? configuredOrigins
          : ['http://localhost:3000', 'http://localhost:3001'];
    }

    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
    });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger configuration (only in non-production environments)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ACME BROS API')
      .setDescription('Music Licensing Workflow API for ACME BROS PICTURES')
      .setVersion('1.0')
      .addTag('movies', 'Movie management endpoints')
      .addTag('scenes', 'Scene management endpoints')
      .addTag('songs', 'Song management endpoints')
      .addTag('tracks', 'Track and licensing management endpoints')
      .addTag('health', 'Health check endpoints')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(
      `Swagger documentation available at: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API prefix: /${apiPrefix}`);
  logger.log(
    `Health check available at: http://localhost:${port}/${apiPrefix}/health`,
  );

  // Graceful shutdown handling
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch(error => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error.stack);
  process.exit(1);
});
