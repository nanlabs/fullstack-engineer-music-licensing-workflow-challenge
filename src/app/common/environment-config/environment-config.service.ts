import { ConfigService } from '@nestjs/config'
import { Injectable } from '@nestjs/common'

@Injectable()
export class EnvironmentConfigService {
  constructor(private readonly configService: ConfigService) {}
  getDatabaseHost(): string {
    return this.configService.getOrThrow<string>('POSTGRES_HOST')
  }
  getDatabasePort(): number {
    return Number(this.configService.getOrThrow<string>('POSTGRES_PORT'))
  }
  getDatabaseUser(): string {
    return this.configService.getOrThrow<string>('POSTGRES_USER')
  }
  getDatabasePassword(): string {
    return this.configService.getOrThrow<string>('POSTGRES_PASSWORD')
  }
  getDatabaseName(): string {
    return this.configService.getOrThrow<string>('POSTGRES_DB')
  }
  getDatabaseSync(): boolean | undefined {
    const databaseSync = this.configService.get<string>('DATABASE_SYNC')
    if (databaseSync === 'true') {
      return true
    }
    if (databaseSync === 'false') {
      return false
    }
    return false
  }
  getEnvironment(): string {
    return this.configService.getOrThrow<string>('NODE_ENV')
  }
}
