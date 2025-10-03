import { INestApplication, ValidationPipe } from '@nestjs/common'

import { throwError } from '@/src/shared/utils/throw-error'
import { parseError } from '@/src/shared/utils/parse-error'

import { APPLICATION_ERRORS } from '../common/response-normalizer/errors'

export const setupPipes = (app: INestApplication) => {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      validateCustomDecorators: true,
      exceptionFactory: errors => {
        throwError(APPLICATION_ERRORS.INPUT.INVALID_INPUT_ERROR, {
          detail: parseError(errors),
        })
      },
    }),
  )
}
