import { HttpException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';

export class I18nException extends HttpException {
  constructor(
    messageKey: string,
    statusCode: number,
    private readonly i18n: I18nService,
  ) {
    const message = i18n.t(messageKey, {
      lang: I18nContext.current()?.lang,
    });

    super(message as string, statusCode);
  }
}
