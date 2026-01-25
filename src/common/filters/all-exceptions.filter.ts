import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  HttpExceptionResponse,
  isHttpExceptionResponse,
} from '../interfaces/exception-response.interface';

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
    let sanitizedMessage: string;
    if (nodeEnv === 'production') {
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        sanitizedMessage = 'An error occurred. Please contact support.';
      } else if (typeof message === 'string') {
        sanitizedMessage = message;
      } else if (isHttpExceptionResponse(message)) {
        const msg = message.message;
        sanitizedMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else {
        sanitizedMessage = 'An error occurred';
      }
    } else {
      if (typeof message === 'string') {
        sanitizedMessage = message;
      } else if (isHttpExceptionResponse(message)) {
        const msg = message.message;
        sanitizedMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else {
        sanitizedMessage = 'Internal server error';
      }
    }

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
