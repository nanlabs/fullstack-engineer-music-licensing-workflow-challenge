import { DataSource } from 'typeorm';

export abstract class BaseSeeder {
  constructor(protected dataSource: DataSource) {}

  abstract seed(): Promise<void>;

  async run(): Promise<void> {
    try {
      console.log(`🌱 Seeding ${this.constructor.name}...`);
      await this.seed();
      console.log(`✅ ${this.constructor.name} seeded successfully`);
    } catch (error) {
      console.error(`❌ Error seeding ${this.constructor.name}:`, error);
      throw error;
    }
  }
}
