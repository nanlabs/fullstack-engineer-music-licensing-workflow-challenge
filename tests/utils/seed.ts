import { DataSource } from 'typeorm'

import { FullSeedMigration } from './seeds'

export async function seedDb(db: DataSource) {
  const queryRunner = db.createQueryRunner()
  await new FullSeedMigration().up(queryRunner)
  await queryRunner.release()
}
