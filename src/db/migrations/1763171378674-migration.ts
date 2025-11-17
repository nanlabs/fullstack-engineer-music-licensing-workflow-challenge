import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1763171378674 implements MigrationInterface {
  name = 'Migration1763171378674';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "Movie" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_56d58b76292b87125c5ec8bdde0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Scene" ("id" SERIAL NOT NULL, "movie_id" integer NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_08d02de03bcfcd5fd7282b2378b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Song" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "artist" character varying(255) NOT NULL, "genre" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_54faca34fbc52deb233dc658d2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "License_Status_History" ("id" SERIAL NOT NULL, "license_id" integer NOT NULL, "status_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fc486dca39a4ad403ad0779b4d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Status" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, CONSTRAINT "PK_343536a4489d5ce9d993aba7776" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "License" ("id" SERIAL NOT NULL, "track_id" integer NOT NULL, "status_id" integer NOT NULL, CONSTRAINT "UQ_b72ab4b8c153c252e556f2712da" UNIQUE ("track_id"), CONSTRAINT "REL_b72ab4b8c153c252e556f2712d" UNIQUE ("track_id"), CONSTRAINT "PK_6acb8469749ceb97c1219af491e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Track" ("id" SERIAL NOT NULL, "scene_id" integer NOT NULL, "song_id" integer NOT NULL, "start_time_seconds" integer NOT NULL, "end_time_seconds" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_51ee6369b97c61b87ff510bcd33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "Scene" ADD CONSTRAINT "FK_cbd1b6c1ce58f02be4fe07617e0" FOREIGN KEY ("movie_id") REFERENCES "Movie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "License_Status_History" ADD CONSTRAINT "FK_06817592d6555445c4a7b0e4ed2" FOREIGN KEY ("license_id") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "License_Status_History" ADD CONSTRAINT "FK_845ab0e220f5f4342d1c2afeeda" FOREIGN KEY ("status_id") REFERENCES "Status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "License" ADD CONSTRAINT "FK_b72ab4b8c153c252e556f2712da" FOREIGN KEY ("track_id") REFERENCES "Track"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "License" ADD CONSTRAINT "FK_151114faaa1229810967d554d4f" FOREIGN KEY ("status_id") REFERENCES "Status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Track" ADD CONSTRAINT "FK_4f705f9d2d6ac472df71310a413" FOREIGN KEY ("scene_id") REFERENCES "Scene"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Track" ADD CONSTRAINT "FK_935bdce77c8e8db5c3f7bc22604" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Track" DROP CONSTRAINT "FK_935bdce77c8e8db5c3f7bc22604"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Track" DROP CONSTRAINT "FK_4f705f9d2d6ac472df71310a413"`,
    );
    await queryRunner.query(
      `ALTER TABLE "License" DROP CONSTRAINT "FK_151114faaa1229810967d554d4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "License" DROP CONSTRAINT "FK_b72ab4b8c153c252e556f2712da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "License_Status_History" DROP CONSTRAINT "FK_845ab0e220f5f4342d1c2afeeda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "License_Status_History" DROP CONSTRAINT "FK_06817592d6555445c4a7b0e4ed2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Scene" DROP CONSTRAINT "FK_cbd1b6c1ce58f02be4fe07617e0"`,
    );
    await queryRunner.query(`DROP TABLE "Track"`);
    await queryRunner.query(`DROP TABLE "License"`);
    await queryRunner.query(`DROP TABLE "Status"`);
    await queryRunner.query(`DROP TABLE "License_Status_History"`);
    await queryRunner.query(`DROP TABLE "Song"`);
    await queryRunner.query(`DROP TABLE "Scene"`);
    await queryRunner.query(`DROP TABLE "Movie"`);
  }
}
