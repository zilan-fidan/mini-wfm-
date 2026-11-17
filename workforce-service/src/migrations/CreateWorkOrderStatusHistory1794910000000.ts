import {MigrationInterface,QueryRunner } from 'typeorm';

export class CreateWorkOrderStatusHistory1794910000000
  implements MigrationInterface
{
  name = 'CreateWorkOrderStatusHistory1794910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workforce"."work_order_status_history" (
        "id" SERIAL NOT NULL,
        "work_order_id" integer NOT NULL,
        "from_status" "workforce"."work_order_status_enum",
        "to_status" "workforce"."work_order_status_enum" NOT NULL,
        "team_id" integer,
        "reason" varchar(500),
        "changed_by_id" integer NOT NULL,
        "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_work_order_status_history"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_work_order_status_history_work_order"
          FOREIGN KEY ("work_order_id")
          REFERENCES "workforce"."work_order"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_work_order_status_history_account"
          FOREIGN KEY ("changed_by_id")
          REFERENCES "workforce"."account"("id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_work_order_status_history_work_order_id"
      ON "workforce"."work_order_status_history" ("work_order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "workforce"."IDX_work_order_status_history_work_order_id"
    `);

    await queryRunner.query(`
      DROP TABLE "workforce"."work_order_status_history"
    `);
  }
}
