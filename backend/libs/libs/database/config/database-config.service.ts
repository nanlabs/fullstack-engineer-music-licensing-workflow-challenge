import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from './database-config';

@Injectable()
export class DatabaseConfigService implements DatabaseConfig {
  constructor(private configService: ConfigService) {}

  get host(): string {
    return this.configService.get<string>('DB_HOST') ?? '';
  }

  get port(): string {
    return this.configService.get<string>('DB_PORT') ?? '';
  }

  get user(): string {
    return this.configService.get<string>('DB_USER') ?? '';
  }

  get password(): string {
    return this.configService.get<string>('DB_PASSWORD') ?? '';
  }

  get name(): string {
    return this.configService.get<string>('DB_NAME') ?? '';
  }
}
