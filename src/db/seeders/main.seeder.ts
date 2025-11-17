import { DataSource } from 'typeorm';
import { dataSource } from '../datasource';
import { BaseSeeder } from './base.seeder';
import { StatusSeeder } from './status.seeder';
import { SongSeeder } from './song.seeder';
import { MovieSeeder } from './movie.seeder';
import { SceneSeeder } from './scene.seeder';
import { TrackSeeder } from './track.seeder';
import { LicenseSeeder } from './license.seeder';

export class MainSeeder {
  private dataSource: DataSource;
  private seeders: BaseSeeder[];

  constructor() {
    this.dataSource = dataSource;
    this.seeders = [
      new StatusSeeder(this.dataSource),
      new SongSeeder(this.dataSource),
      new MovieSeeder(this.dataSource),
      new SceneSeeder(this.dataSource),
      new TrackSeeder(this.dataSource),
      new LicenseSeeder(this.dataSource),
    ];
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting database seeding...\n');

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        console.log('✅ Database connection established\n');
      }

      for (const seeder of this.seeders) {
        await seeder.run();
      }

      console.log('\n✨ Database seeding completed successfully!');
    } catch (error) {
      console.error('\n❌ Error during seeding:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        console.log('🔌 Database connection closed');
      }
    }
  }
}

if (require.main === module) {
  const seeder = new MainSeeder();
  seeder
    .run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
