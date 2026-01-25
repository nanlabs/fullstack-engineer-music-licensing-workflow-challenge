import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const requestId = request.headers['x-request-id'] || 'N/A';

    const now = Date.now();

    this.logger.log(`→ ${method} ${url} - ${ip} - ${userAgent} [${requestId}]`);

    return next.handle().pipe(
      tap({
        next: () => {
          const delay = Date.now() - now;
          this.logger.log(
            `← ${method} ${url} ${response.statusCode} - ${delay}ms [${requestId}]`,
          );
        },
        error: error => {
          const delay = Date.now() - now;
          this.logger.error(
            `✗ ${method} ${url} ${error.status || 500} - ${delay}ms [${requestId}]`,
          );
        },
      }),
    );
  }
}
