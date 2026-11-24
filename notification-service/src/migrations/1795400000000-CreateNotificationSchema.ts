import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationSchema1795400000000 implements MigrationInterface {
  name = 'CreateNotificationSchema1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "notification"`);

    await queryRunner.query(`
      CREATE TABLE "notification"."notification" (
        "id" SERIAL NOT NULL,
        "event_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "workforce_user_id" integer NOT NULL,
        "title" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_event_user" UNIQUE ("event_id", "workforce_user_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_user_created"
      ON "notification"."notification" ("workforce_user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification"."notification"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "notification"`);
  }
}
