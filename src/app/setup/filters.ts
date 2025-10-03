import { INestApplication } from '@nestjs/common'

import { ErrorResponseNormalizerFilter } from '../common/response-normalizer/error-response-normalizer.filter'

export const setupFilters = (app: INestApplication) => {
  app.useGlobalFilters(app.get(ErrorResponseNormalizerFilter))
}
