import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { createI18nConfig } from './i18n.config';
import { ConfigService } from '@nestjs/config';

const configModule = NestConfigModule.forRoot({ isGlobal: true });

export const AppConfigModule = [
  configModule,
  I18nModule.forRootAsync({
    useFactory: createI18nConfig,
    resolvers: [
      { use: QueryResolver, options: ['lang'] },
      AcceptLanguageResolver,
    ],
    inject: [ConfigService],
  }),
];
