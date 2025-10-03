import { INestApplication } from '@nestjs/common'

import { API } from '../constants/api.constants'

export const setupPrefix = (app: INestApplication) => {
  app.setGlobalPrefix(API)
}
