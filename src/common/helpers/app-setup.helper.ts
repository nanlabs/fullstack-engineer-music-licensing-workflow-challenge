import { INestApplication, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nValidationPipe } from 'nestjs-i18n';
import { CatchEverythingFilter } from '../filters/catchEverything.filter';
import { I18nValidationExceptionFilter } from 'nestjs-i18n';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { API_PREFIX } from '../constants/api.constants';
import { HttpLoggingInterceptor } from '../interceptors/http-logging.interceptor';

export function setupApp(app: INestApplication): void {
  const logger = new Logger('AppSetup');

  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setGlobalPrefix(API_PREFIX);
  logger.log(`Global API prefix set to: ${API_PREFIX}`);

  app.useGlobalPipes(
    new I18nValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new HttpLoggingInterceptor(),
  );

  app.useGlobalFilters(
    new CatchEverythingFilter(),
    new I18nValidationExceptionFilter(),
  );

  logger.log('Application configuration completed');
}
