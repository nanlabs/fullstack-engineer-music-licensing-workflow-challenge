import { config } from 'dotenv';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed-data';
import { typeormConfig } from '../../config/typeorm.config';

config({ path: join(__dirname, '../../../.env') });

const logger = new Logger('SeedScript');

async function runSeed() {
  const dataSource = new DataSource(typeormConfig);

  try {
    await dataSource.initialize();
    logger.log('Database connection established');

    await seedDatabase(dataSource);

    await dataSource.destroy();
    logger.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(
      'Error running seed',
      error instanceof Error ? error.stack : String(error),
    );
    await dataSource.destroy();
    process.exit(1);
  }
}

runSeed();
