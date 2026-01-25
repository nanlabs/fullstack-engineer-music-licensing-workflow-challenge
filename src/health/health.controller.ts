import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check application health' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  @ApiResponse({ status: 503, description: 'Application is unhealthy' })
  check() {
    const memoryHeapThreshold =
      this.configService.get<number>('app.healthCheck.memoryHeapThreshold') ||
      150 * 1024 * 1024; // Default: 150MB
    const memoryRssThreshold =
      this.configService.get<number>('app.healthCheck.memoryRssThreshold') ||
      150 * 1024 * 1024; // Default: 150MB
    const diskThresholdPercent =
      this.configService.get<number>(
        'app.healthCheck.diskThresholdPercent',
      ) || 0.9; // Default: 90%

    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', memoryHeapThreshold),
      () => this.memory.checkRSS('memory_rss', memoryRssThreshold),
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: diskThresholdPercent,
        }),
    ]);
  }

  @Get('database')
  @HealthCheck()
  @ApiOperation({ summary: 'Check database connectivity' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  checkDatabase() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  checkReady() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  checkLive() {
    const livenessMemoryThreshold =
      this.configService.get<number>(
        'app.healthCheck.livenessMemoryThreshold',
      ) || 300 * 1024 * 1024; // Default: 300MB

    return this.health.check([
      () => this.memory.checkHeap('memory_heap', livenessMemoryThreshold),
    ]);
  }
}
