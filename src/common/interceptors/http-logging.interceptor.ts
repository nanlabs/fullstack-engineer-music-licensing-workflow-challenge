import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip || request.connection.remoteAddress;

    const now = Date.now();

    // Skip logging for health checks
    if (url.includes('/health')) {
      return next.handle();
    }

    // Log request details
    this.logger.log(
      `${method} ${url} - ${ip} - ${userAgent}` +
        (Object.keys(query).length > 0
          ? ` Query: ${JSON.stringify(query)}`
          : '') +
        (Object.keys(params).length > 0
          ? ` Params: ${JSON.stringify(params)}`
          : '') +
        (body && Object.keys(body).length > 0
          ? ` Body: ${JSON.stringify(this.sanitizeBody(body))}`
          : ''),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const delay = Date.now() - now;

          if (statusCode >= 400) {
            this.logger.warn(`${method} ${url} ${statusCode} - ${delay}ms`);
          } else {
            this.logger.log(`${method} ${url} ${statusCode} - ${delay}ms`);
          }
        },
        error: (error) => {
          const delay = Date.now() - now;
          const statusCode = error?.status || error?.statusCode || 500;

          this.logger.error(
            `${method} ${url} ${statusCode} - ${delay}ms - ${error.message}`,
          );
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    // Remove sensitive fields from logging
    const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
    const sanitized = JSON.parse(JSON.stringify(body)); // Deep clone

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map((item) =>
          typeof item === 'object' ? sanitizeObject(item) : item,
        );
      }

      for (const key in obj) {
        if (
          sensitiveFields.some((field) =>
            key.toLowerCase().includes(field.toLowerCase()),
          )
        ) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          obj[key] = sanitizeObject(obj[key]);
        }
      }

      return obj;
    };

    return sanitizeObject(sanitized);
  }
}
