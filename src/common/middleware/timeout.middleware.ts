import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TimeoutMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TimeoutMiddleware.name);
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    this.timeout = this.configService.get<number>('app.requestTimeout', 30000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        this.logger.warn(`Request timeout: ${req.method} ${req.url}`);
        res.status(408).json({
          success: false,
          statusCode: 408,
          message: 'Request timeout',
          timestamp: new Date().toISOString(),
        });
      }
    }, this.timeout);

    // Clear timeout on all completion events to prevent memory leaks
    const clearTimeoutHandler = () => clearTimeout(timeoutId);
    res.on('finish', clearTimeoutHandler);
    res.on('error', clearTimeoutHandler);
    res.on('close', clearTimeoutHandler);

    next();
  }
}
