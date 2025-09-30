import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema001 implements MigrationInterface {
  name = 'InitialSchema001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create movies table
    await queryRunner.query(`
      CREATE TABLE "movies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "title" character varying(255) NOT NULL,
        "description" text,
        "director" character varying(100),
        "producer" character varying(100),
        "releaseDate" date,
        "status" character varying(50) NOT NULL DEFAULT 'development',
        CONSTRAINT "PK_movies" PRIMARY KEY ("id")
      )
    `);

    // Create scenes table
    await queryRunner.query(`
      CREATE TABLE "scenes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "duration" integer,
        "startTime" integer,
        "movieId" uuid NOT NULL,
        CONSTRAINT "PK_scenes" PRIMARY KEY ("id")
      )
    `);

    // Create songs table
    await queryRunner.query(`
      CREATE TABLE "songs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "title" character varying(255) NOT NULL,
        "artist" character varying(255) NOT NULL,
        "duration" integer,
        "rightsHolder" character varying(255),
        CONSTRAINT "PK_songs" PRIMARY KEY ("id")
      )
    `);

    // Create tracks table
    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(255) NOT NULL,
        "startTime" integer NOT NULL,
        "endTime" integer NOT NULL,
        "volume" integer,
        "description" text,
        "sceneId" uuid NOT NULL,
        "songId" uuid NOT NULL,
        CONSTRAINT "PK_tracks" PRIMARY KEY ("id")
      )
    `);

    // Create licensing status enum
    await queryRunner.query(`
      CREATE TYPE "licensing_status_enum" AS ENUM (
        'pending', 'in_review', 'negotiating', 'approved', 'rejected', 'expired'
      )
    `);

    // Create licenses table
    await queryRunner.query(`
      CREATE TABLE "licenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "status" "licensing_status_enum" NOT NULL DEFAULT 'pending',
        "licenseFee" numeric(10,2),
        "currency" character varying(10) NOT NULL DEFAULT 'USD',
        "licenseStartDate" date,
        "licenseEndDate" date,
        "terms" text,
        "notes" text,
        "contactPerson" character varying(255),
        "contactEmail" character varying(255),
        "contactPhone" character varying(50),
        "lastStatusChange" TIMESTAMP WITH TIME ZONE,
        "trackId" uuid NOT NULL,
        CONSTRAINT "PK_licenses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_licenses_trackId" UNIQUE ("trackId")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "scenes"
      ADD CONSTRAINT "FK_scenes_movieId"
      FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tracks"
      ADD CONSTRAINT "FK_tracks_sceneId"
      FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tracks"
      ADD CONSTRAINT "FK_tracks_songId"
      FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "licenses"
      ADD CONSTRAINT "FK_licenses_trackId"
      FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "licenses"`);
    await queryRunner.query(`DROP TABLE "tracks"`);
    await queryRunner.query(`DROP TABLE "songs"`);
    await queryRunner.query(`DROP TABLE "scenes"`);
    await queryRunner.query(`DROP TABLE "movies"`);
    await queryRunner.query(`DROP TYPE "licensing_status_enum"`);
  }
}