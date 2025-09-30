import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Music Licensing API is running!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'music-licensing-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}