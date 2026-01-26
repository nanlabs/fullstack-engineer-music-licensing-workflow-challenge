import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface Response<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | T
> {
  constructor(private readonly configService: ConfigService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || 'N/A';

    // Skip transformation for health checks and endpoints that return no content
    const url = request.url;
    const skipPaths = this.configService.get<string[]>(
      'app.transformInterceptor.skipPaths',
    ) || ['/health', '/docs'];

    // Check if URL matches any skip paths exactly or starts with path followed by / or end of string
    // This prevents /health-check from matching /health
    if (
      skipPaths.some(
        path =>
          url === path ||
          url === `${path}/` ||
          (url.startsWith(path) &&
            (url.length === path.length ||
              url[path.length] === '/' ||
              url[path.length] === '?')),
      )
    ) {
      return next.handle();
    }

    // Note: Status code check removed as response.statusCode isn't set at this point
    // Status codes are handled by checking the response after it's sent

    return next.handle().pipe(
      map(data => {
        // Don't transform if data is already transformed or is an error response
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'meta' in data
        ) {
          return data;
        }

        // Skip transformation for null/undefined data
        if (data === null || data === undefined) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        };
      }),
    );
  }
}
