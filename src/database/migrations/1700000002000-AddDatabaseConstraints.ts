import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDatabaseConstraints1700000002000 implements MigrationInterface {
  name = 'AddDatabaseConstraints1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique constraint on movie title (assuming titles should be unique)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_movies_title_unique" 
      ON "movies" ("title")
    `);

    // Unique constraint on scene (movieId, sceneNumber) to prevent duplicate scene numbers
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_scenes_movieId_sceneNumber_unique" 
      ON "scenes" ("movieId", "sceneNumber")
    `);

    // Unique constraint on song (title, artist) to prevent duplicate songs
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_songs_title_artist_unique" 
      ON "songs" ("title", "artist")
    `);

    // Check constraint: endTime > startTime for scenes
    await queryRunner.query(`
      ALTER TABLE "scenes" 
      ADD CONSTRAINT "CHK_scenes_endTime_gt_startTime" 
      CHECK ("endTime" IS NULL OR "startTime" IS NULL OR "endTime" > "startTime")
    `);

    // Check constraint: endTime > startTime for tracks
    await queryRunner.query(`
      ALTER TABLE "tracks" 
      ADD CONSTRAINT "CHK_tracks_endTime_gt_startTime" 
      CHECK ("endTime" > "startTime")
    `);

    // Check constraint: releaseYear must be reasonable (1900-2100)
    await queryRunner.query(`
      ALTER TABLE "movies" 
      ADD CONSTRAINT "CHK_movies_releaseYear_range" 
      CHECK ("releaseYear" >= 1900 AND "releaseYear" <= 2100)
    `);

    // Index on movieId for scenes (foreign key lookup optimization)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scenes_movieId" 
      ON "scenes" ("movieId")
    `);

    // Index on sceneId for tracks (foreign key lookup optimization)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tracks_sceneId" 
      ON "tracks" ("sceneId")
    `);

    // Index on songId for tracks (foreign key lookup optimization)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tracks_songId" 
      ON "tracks" ("songId")
    `);

    // Index on trackId for licensing_statuses (foreign key lookup optimization)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_licensing_statuses_trackId" 
      ON "licensing_statuses" ("trackId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_licensing_statuses_trackId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tracks_songId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tracks_sceneId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scenes_movieId"`);
    await queryRunner.query(
      `ALTER TABLE "movies" DROP CONSTRAINT IF EXISTS "CHK_movies_releaseYear_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tracks" DROP CONSTRAINT IF EXISTS "CHK_tracks_endTime_gt_startTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scenes" DROP CONSTRAINT IF EXISTS "CHK_scenes_endTime_gt_startTime"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_songs_title_artist_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_scenes_movieId_sceneNumber_unique"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_movies_title_unique"`);
  }
}
