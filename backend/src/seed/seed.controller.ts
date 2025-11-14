import { Get } from '@nestjs/common';
import { SeedService } from './seed.service';
import { ApiController } from 'src/shared/decorators';

@ApiController('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  async runSeed() {
    return await this.seedService.runSeed();
  }
}
