import { DataSource, DataSourceOptions } from 'typeorm';
import { seedDatabase } from '../seeds/seed-data';

async function runSeed() {
  console.log('Initializing database seeding...');

  const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'music_licensing',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: true,
    logging: true,
  };

  const dataSource = new DataSource(dataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    await seedDatabase(dataSource);

    console.log('\nReady to test! Endpoints:');
    console.log('GET /licenses/workflow-summary - See license counts');
    console.log('GET /movies - See all movies');
    console.log('GET /scenes?movieId={id} - See scenes for a movie');
    console.log('GET /tracks?sceneId={id} - See tracks for a scene');
    console.log('PATCH /licenses/{id}/status - Update license status');
    console.log('GraphQL Playground: http://localhost:3000/graphql');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('Database connection closed');
    process.exit(0);
  }
}

runSeed();