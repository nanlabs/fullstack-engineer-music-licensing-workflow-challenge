import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const requestId =
      (request.headers['x-request-id'] as string) || 'N/A';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Sanitize error message in production
    const sanitizedMessage =
      nodeEnv === 'production'
        ? status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'An error occurred. Please contact support.'
          : typeof message === 'string'
            ? message
            : (message as any).message || 'An error occurred'
        : typeof message === 'string'
          ? message
          : (message as any).message || 'Internal server error';

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId,
      message: sanitizedMessage,
      ...(nodeEnv === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json(errorResponse);
  }
}
