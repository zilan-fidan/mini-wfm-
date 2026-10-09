import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkforceSchema1790000000000
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SCHEMA IF NOT EXISTS workforce`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP SCHEMA IF EXISTS workforce`
    );
  }
}

