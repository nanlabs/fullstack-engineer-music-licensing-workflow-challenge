import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { swaggerConfig } from './config';
import { setupApp } from './common/helpers/app-setup.helper';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3000;

  try {
    logger.log('Starting application...');

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    setupApp(app);
    swaggerConfig(app);

    await app.listen(port);

    logger.log(`Application is running on: http://localhost:${port}`);
    logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();
