import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamToWorkforceUser1793003518431 implements MigrationInterface {
    name = 'AddTeamToWorkforceUser1793003518431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workforce"."workforce_user" ADD "team_id" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_7d1b90969d41d4594f7aea9403" ON "workforce"."workforce_user" ("team_id") `);
        await queryRunner.query(`ALTER TABLE "workforce"."workforce_user" ADD CONSTRAINT "FK_7d1b90969d41d4594f7aea94032" FOREIGN KEY ("team_id") REFERENCES "workforce"."team"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workforce"."workforce_user" DROP CONSTRAINT "FK_7d1b90969d41d4594f7aea94032"`);
        await queryRunner.query(`DROP INDEX "workforce"."IDX_7d1b90969d41d4594f7aea9403"`);
        await queryRunner.query(`ALTER TABLE "workforce"."workforce_user" DROP COLUMN "team_id"`);
    }

}
