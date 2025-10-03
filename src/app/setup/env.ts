import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const getEnvVariables = (app: INestApplication) => {
  const configService = app.get(ConfigService)

  return {
    port: Number(configService.get<string>('PORT', '4000')),
    nodeEnv: configService.get<string>('NODE_ENV'),
  }
}
