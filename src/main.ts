import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Register global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Music Licensing Workflow API')
    .setDescription('API for managing music licensing workflows in movies')
    .setVersion('1.0.0')
    .addTag('movies', 'Movie management')
    .addTag('scenes', 'Scene management')
    .addTag('songs', 'Song management')
    .addTag('tracks', 'Track management')
    .addTag('licenses', 'License management')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove undeclared properties
      forbidNonWhitelisted: true, // refuse requests with extra fields
      transform: true, // convert automatically the types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api`,
  );
}
void bootstrap();
