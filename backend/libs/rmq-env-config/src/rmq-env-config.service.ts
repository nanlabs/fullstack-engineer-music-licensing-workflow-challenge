import { Injectable } from '@nestjs/common';
import { RmqEnvConfig } from './rmq-env-config';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RmqEnvConfigService implements RmqEnvConfig {
  constructor(private configService: ConfigService) {}

  get host(): string {
    return this.configService.get<string>('RMQ_HOST') ?? '';
  }

  get port(): string {
    return this.configService.get<string>('RMQ_PORT') ?? '';
  }
  get url(): string {
    return this.configService.get<string>('RMQ_URL') ?? '';
  }
}
