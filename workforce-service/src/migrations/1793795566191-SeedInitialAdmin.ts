import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedInitialAdmin1793790000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!username || !password || password.length < 8) {
      throw new Error('İlk admin bilgileri eksik veya geçersiz');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await queryRunner.query(
      `INSERT INTO "workforce"."account"
       ("username", "password_hash", "role")
       VALUES ($1, $2, $3)`,
      [username, passwordHash, 'ADMIN'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();

    if (!username) {
      throw new Error('INITIAL_ADMIN_USERNAME gerekli');
    }

    await queryRunner.query(
      `DELETE FROM "workforce"."account"
       WHERE "username" = $1 AND "role" = $2`,
      [username, 'ADMIN'],
    );
  }
}
