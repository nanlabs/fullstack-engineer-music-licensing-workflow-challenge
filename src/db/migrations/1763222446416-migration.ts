import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1763222446416 implements MigrationInterface {
  name = 'Migration1763222446416';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Movie" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "Scene" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "Song" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "Track" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "Track" DROP COLUMN "is_deleted"`);
    await queryRunner.query(`ALTER TABLE "Song" DROP COLUMN "is_deleted"`);
    await queryRunner.query(`ALTER TABLE "Scene" DROP COLUMN "is_deleted"`);
    await queryRunner.query(`ALTER TABLE "Movie" DROP COLUMN "is_deleted"`);
  }
}
