import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverdueNotifiedAtToWorkOrder1795500000000 implements MigrationInterface {
  name = 'AddOverdueNotifiedAtToWorkOrder1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NULL = gecikme olayı henüz yayınlanmadı. Dolu = yayınlandı (ya da yayın sırası bu kayıtta).
    await queryRunner.query(`
      ALTER TABLE "workforce"."work_order"
      ADD COLUMN "overdue_notified_at" TIMESTAMPTZ NULL
    `);

    // Zamanlanmış iş yalnızca "bildirilmemiş ve kapanmamış" kayıtlara bakar.
    // Kısmi index sadece bu satırları içerir; tablo büyüse de index küçük kalır.
    await queryRunner.query(`
      CREATE INDEX "IDX_work_order_overdue_pending"
      ON "workforce"."work_order" ("due_at")
      WHERE "overdue_notified_at" IS NULL
        AND "status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "workforce"."IDX_work_order_overdue_pending"`);
    await queryRunner.query(`ALTER TABLE "workforce"."work_order" DROP COLUMN "overdue_notified_at"`);
  }
}
