import { DataSource } from 'typeorm';
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();

export const dataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: +configService.get('DB_PORT'),
  username: configService.get('DB_USER'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrationsRun: true,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
