import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMoviesSchema1758412952641 implements MigrationInterface {
  name = 'CreateMoviesSchema1758412952641';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "movies"."license_statuses_status_enum" AS ENUM('pending', 'in_review', 'negotiating', 'approved', 'rejected', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "movies"."license_statuses" ("id" SERIAL NOT NULL, "status" "movies"."license_statuses_status_enum" NOT NULL DEFAULT 'pending', "song_id" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f5c2a5f33935094c8b42a09d787" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "movies"."songs" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "artist" character varying(255) NOT NULL, "album" character varying(255), "releaseYear" integer, "genre" character varying(255), "durationSeconds" integer, "current_license_status_id" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e504ce8ad2e291d3a1d8f1ea2f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "movies"."tracks" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "startTimeSeconds" numeric(10,3) NOT NULL, "endTimeSeconds" numeric(10,3) NOT NULL, "notes" text, "scene_id" integer NOT NULL, "song_id" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_242a37ffc7870380f0e611986e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "movies"."scenes" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "sceneNumber" integer NOT NULL, "durationSeconds" integer, "notes" text, "movie_id" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_071fd0f410cbb449feebafd46ac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "movies"."movies" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "description" text, "director" character varying(100), "releaseYear" integer, "status" character varying(50) NOT NULL DEFAULT 'development', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c5b2c134e871bfd1c2fe7cc3705" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "movies"."license_statuses" ADD CONSTRAINT "fk_license_statuses_song_id" FOREIGN KEY ("song_id") REFERENCES "movies"."songs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movies"."songs" ADD CONSTRAINT "fk_songs_current_license_status_id" FOREIGN KEY ("current_license_status_id") REFERENCES "movies"."license_statuses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movies"."tracks" ADD CONSTRAINT "fk_tracks_scene_id" FOREIGN KEY ("scene_id") REFERENCES "movies"."scenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movies"."tracks" ADD CONSTRAINT "fk_tracks_song_id" FOREIGN KEY ("song_id") REFERENCES "movies"."songs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movies"."scenes" ADD CONSTRAINT "fk_scenes_movie_id" FOREIGN KEY ("movie_id") REFERENCES "movies"."movies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movies"."scenes" DROP CONSTRAINT "fk_scenes_movie_id"`);
    await queryRunner.query(`ALTER TABLE "movies"."tracks" DROP CONSTRAINT "fk_tracks_song_id"`);
    await queryRunner.query(`ALTER TABLE "movies"."tracks" DROP CONSTRAINT "fk_tracks_scene_id"`);
    await queryRunner.query(
      `ALTER TABLE "movies"."songs" DROP CONSTRAINT "fk_songs_current_license_status_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movies"."license_statuses" DROP CONSTRAINT "fk_license_statuses_song_id"`,
    );
    await queryRunner.query(`DROP TABLE "movies"."movies"`);
    await queryRunner.query(`DROP TABLE "movies"."scenes"`);
    await queryRunner.query(`DROP TABLE "movies"."tracks"`);
    await queryRunner.query(`DROP TABLE "movies"."songs"`);
    await queryRunner.query(`DROP TABLE "movies"."license_statuses"`);
    await queryRunner.query(`DROP TYPE "movies"."license_statuses_status_enum"`);
  }
}
