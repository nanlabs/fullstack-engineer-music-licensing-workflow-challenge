import { ConfigService } from '@nestjs/config';
import { I18nOptions } from 'nestjs-i18n';
import { join } from 'path';

export const createI18nConfig = (configService: ConfigService): I18nOptions => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    fallbackLanguage: configService.getOrThrow('FALLBACK_LANGUAGE'),
    loaderOptions: {
      path: join(__dirname, '../i18n/'),
      watch: !isProd,
    },
  };
};
