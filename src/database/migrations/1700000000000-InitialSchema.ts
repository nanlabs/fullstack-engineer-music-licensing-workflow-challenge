import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TYPE "licensing_state_enum" AS ENUM('pending', 'negotiating', 'approved', 'rejected', 'expired');
    `);

    await queryRunner.query(`
      CREATE TABLE "movies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "description" text,
        "director" varchar(100),
        "releaseYear" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_movies" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "scenes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "movieId" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "sceneNumber" integer,
        "startTime" decimal(10,2),
        "endTime" decimal(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scenes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_scenes_movie" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "songs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "artist" varchar(255) NOT NULL,
        "album" varchar(255),
        "genre" varchar(100),
        "duration" integer,
        "rightsHolder" varchar(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_songs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sceneId" uuid NOT NULL,
        "songId" uuid NOT NULL,
        "startTime" decimal(10,2) NOT NULL,
        "endTime" decimal(10,2) NOT NULL,
        "currentLicensingStatus" "licensing_state_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tracks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tracks_scene" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracks_song" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "licensing_statuses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trackId" uuid NOT NULL,
        "status" "licensing_state_enum" NOT NULL,
        "notes" text,
        "updatedBy" varchar(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_licensing_statuses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_licensing_statuses_track" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_scenes_movieId" ON "scenes" ("movieId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_sceneId" ON "tracks" ("sceneId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_songId" ON "tracks" ("songId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_licensing_statuses_trackId" ON "licensing_statuses" ("trackId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_licensing_statuses_trackId"`);
    await queryRunner.query(`DROP INDEX "IDX_tracks_songId"`);
    await queryRunner.query(`DROP INDEX "IDX_tracks_sceneId"`);
    await queryRunner.query(`DROP INDEX "IDX_scenes_movieId"`);
    await queryRunner.query(`DROP TABLE "licensing_statuses"`);
    await queryRunner.query(`DROP TABLE "tracks"`);
    await queryRunner.query(`DROP TABLE "songs"`);
    await queryRunner.query(`DROP TABLE "scenes"`);
    await queryRunner.query(`DROP TABLE "movies"`);
    await queryRunner.query(`DROP TYPE "licensing_state_enum"`);
  }
}
