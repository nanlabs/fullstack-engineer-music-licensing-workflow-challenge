import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  private readonly logger = new Logger(CatchEverythingFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const errorMessage = exception?.message || 'Unknown error';
    const errorStack = exception?.stack || 'No stack trace available';

    this.logger.error(
      `${request.method} ${request.url} - Exception: ${errorMessage}`,
      errorStack,
    );

    if (!(exception instanceof HttpException)) {
      exception = new HttpException('Internal server error', 500);
    }

    const status = exception?.getStatus() || 500;

    let body: {
      statusCode: number;
      timestamp: string;
      path: any;
      message: string;
      errors?: any;
    } = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception?.message || 'Internal server error',
    };

    if (typeof exception === 'object') {
      if ('errors' in exception) {
        body = { errors: exception.errors, ...body };
      }
    }

    response.status(status).json(body);
  }
}
