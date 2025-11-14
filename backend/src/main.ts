import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from 'config/envs';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(`api/${envs.apiVersion}`);

  await app.listen(envs.backendPort);
  logger.log(
    `Application is running on: http://localhost:${envs.backendPort}/api/${envs.apiVersion}`,
  );
}
bootstrap();
