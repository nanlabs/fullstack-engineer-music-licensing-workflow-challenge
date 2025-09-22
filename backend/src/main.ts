import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Enable CORS for frontend integration
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001', // Para el archivo HTML de test
      'null', // Para archivos locales
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Music Licensing API')
    .setDescription('API for ACME BROS PICTURES music licensing workflow system')
    .setVersion('1.0')
    .addTag('movies', 'Movie management operations')
    .addTag('scenes', 'Scene management operations')
    .addTag('songs', 'Song management operations')
    .addTag('tracks', 'Track management operations')
    .addTag('licenses', 'License status management operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🔌 WebSocket server available at: ws://localhost:${port}`);
}

bootstrap();
