import {
  InternalServerErrorException,
  BadRequestException,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Catch,
} from '@nestjs/common'
import { FastifyReply } from 'fastify'

import { ApplicationError } from '@/src/shared/utils/throw-error'

@Catch()
export class ErrorResponseNormalizerFilter implements ExceptionFilter {
  async catch(rawException: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp()

    const response = ctx.getResponse<FastifyReply>()

    let exception: HttpException | ApplicationError
    if (
      rawException instanceof ApplicationError ||
      rawException instanceof HttpException
    ) {
      exception = rawException
    } else {
      exception = new InternalServerErrorException()
    }

    const status = exception.getStatus()

    await response.status(status).send({ error: this.mapToError(exception) })
  }

  private mapToError(error: HttpException | ApplicationError) {
    return {
      message: error.message,
      status: error.getStatus(),
      validationErrors: this.getReasons(error),
    }
  }

  private getReasons(error: HttpException | ApplicationError) {
    if (error instanceof ApplicationError) {
      return error.getReasonsDetail()
    }

    if (!(error instanceof BadRequestException)) {
      return
    }

    return error.getResponse()
  }
}
