import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { isHttpExceptionResponse } from '../interfaces/exception-response.interface';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const requestId = (request.headers['x-request-id'] as string) || 'N/A';

    let message: string;
    let error: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = exception.name;
    } else if (isHttpExceptionResponse(exceptionResponse)) {
      const msg = exceptionResponse.message;
      message = Array.isArray(msg) ? msg.join(', ') : msg;
      error = exceptionResponse.error || exception.name;
    } else {
      message = exception.message;
      error = exception.name;
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId,
      message,
      error,
    };

    // Log 404s as warn (client errors), 5xx as error (server errors)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
        exception.stack,
      );
    } else if (status === 404) {
      // 404s are common and expected, log at debug level to reduce noise
      this.logger.debug(
        `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
      );
    } else {
      // Other 4xx errors (400, 401, 403, etc.) log as warn
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
