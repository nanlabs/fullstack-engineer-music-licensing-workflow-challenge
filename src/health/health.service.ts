import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async check() {
    const dbStatus = await this.checkDatabase();
    const poolStatus = this.getPoolStatus();
    return {
      status: dbStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbStatus ? 'connected' : 'disconnected',
      pool: poolStatus,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  private getPoolStatus() {
    const driver = this.dataSource.driver as any;
    if (driver.master && driver.master.pool) {
      const pool = driver.master.pool;
      return {
        totalCount: pool.totalCount || 0,
        idleCount: pool.idleCount || 0,
        waitingCount: pool.waitingCount || 0,
      };
    }
    return null;
  }
}
