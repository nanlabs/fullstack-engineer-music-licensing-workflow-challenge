import { Get } from '@nestjs/common';
import { SeedService } from './seed.service';
import { ApiController } from 'src/shared/decorators';
import { ENVIRONMENT } from '../../config/constants';
import { envs } from '../../config/envs';

@ApiController('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  async runSeed() {
    if (envs.environment === ENVIRONMENT.DEV) {
      return await this.seedService.runSeed();
    }
    return { message: 'Seed is only available in development environment' };
  }
}
