import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// UUID v4 regex pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const providedRequestId = req.headers['x-request-id'] as string;
    let requestId: string;

    // Validate UUID format if provided, otherwise generate new one
    if (providedRequestId && UUID_REGEX.test(providedRequestId)) {
      requestId = providedRequestId;
    } else {
      // If invalid format provided, generate new UUID
      requestId = randomUUID();
    }

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  }
}
