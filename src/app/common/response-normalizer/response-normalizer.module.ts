import { Module } from '@nestjs/common'

import { ErrorResponseNormalizerFilter } from './error-response-normalizer.filter'

@Module({
  providers: [ErrorResponseNormalizerFilter],
  exports: [ErrorResponseNormalizerFilter],
})
export class ResponseNormalizerModule {}
