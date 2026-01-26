import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1700000001000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index on currentLicensingStatus for filtering tracks by status
    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_currentLicensingStatus" 
      ON "tracks" ("currentLicensingStatus")
    `);

    // Composite index for common query pattern (sceneId, songId)
    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_sceneId_songId" 
      ON "tracks" ("sceneId", "songId")
    `);

    // Index on createdAt for licensing_statuses ordering
    await queryRunner.query(`
      CREATE INDEX "IDX_licensing_statuses_createdAt" 
      ON "licensing_statuses" ("createdAt")
    `);

    // Index on createdAt for tracks ordering
    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_createdAt" 
      ON "tracks" ("createdAt")
    `);

    // Index on createdAt for movies ordering
    await queryRunner.query(`
      CREATE INDEX "IDX_movies_createdAt" 
      ON "movies" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_movies_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_tracks_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_licensing_statuses_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_tracks_sceneId_songId"`);
    await queryRunner.query(`DROP INDEX "IDX_tracks_currentLicensingStatus"`);
  }
}
