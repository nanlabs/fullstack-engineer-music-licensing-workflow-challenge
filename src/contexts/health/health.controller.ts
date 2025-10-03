import { Controller } from '@nestjs/common'

import { SwaggerDocs } from '@/src/shared/decorators/swagger.decorator'
import { Endpoint } from '@/src/shared/decorators/endpoint.decorator'
import { HttpMethods } from '@/src/shared/swagger/api-responses-docs'
import { CONTROLLERS } from '@/src/app/constants/api.constants'
import { TAGS } from '@/src/app/constants/docs.contants'

import { HealthCheckResponseDto } from './health.dto'

@Controller(CONTROLLERS.HEALTH)
export class HealthController {
  @SwaggerDocs({
    dataDto: HealthCheckResponseDto,
    httpMethod: HttpMethods.get,
    isPaginated: false,
    errorResponseCodes: [500],
    tags: TAGS.HEALTH,
    summary: 'Health Check',
    description:
      'Returns the current status and uptime of the service. \n\n' +
      'Can be used to verify if the service is running properly. \n\n',
  })
  @Endpoint({
    responseDto: HealthCheckResponseDto,
    operation: HttpMethods.get,
  })
  run() {
    return { status: 'ok', uptime: process.uptime() }
  }
}
