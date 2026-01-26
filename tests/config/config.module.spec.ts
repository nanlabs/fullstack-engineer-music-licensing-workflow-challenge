import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '../../src/config/config.module';
import { ConfigService } from '@nestjs/config';

describe('ConfigModule', () => {
  let module: TestingModule;

  it('should be defined', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should provide ConfigService', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    const configService = module.get<ConfigService>(ConfigService);
    expect(configService).toBeDefined();
  });

  it('should load app configuration', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    const configService = module.get<ConfigService>(ConfigService);
    const appConfig = configService.get('app');
    expect(appConfig).toBeDefined();
    expect(appConfig.port).toBeDefined();
    expect(appConfig.nodeEnv).toBeDefined();
  });

  it('should load database configuration', async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    const configService = module.get<ConfigService>(ConfigService);
    const dbConfig = configService.get('database');
    expect(dbConfig).toBeDefined();
    expect(dbConfig.type).toBe('postgres');
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });
});
