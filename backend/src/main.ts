import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from 'config/envs';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(`api/${envs.apiVersion}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('NaNLABS backend challenge documentation')
    .setVersion(envs.apiVersion)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`api/${envs.apiVersion}/swagger`, app, document);

  await app.listen(envs.backendPort);
  const url = `http://localhost:${envs.backendPort}/api/${envs.apiVersion}`;
  logger.log(`Application is running on: ${url}`);
  logger.log(`Swagger documentation is running on: ${url}/swagger`);
}
bootstrap();
