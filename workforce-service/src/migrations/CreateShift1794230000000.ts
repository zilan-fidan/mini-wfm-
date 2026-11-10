import {MigrationInterface,QueryRunner,Table,TableForeignKey,TableIndex,} from 'typeorm';

export class CreateShift1794230000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        schema: 'workforce',
        name: 'shift',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'workforce_user_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'start_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'end_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'note',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'created_by_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('workforce.shift', [
      new TableForeignKey({
        name: 'FK_shift_workforce_user',
        columnNames: ['workforce_user_id'],
        referencedSchema: 'workforce',
        referencedTableName: 'workforce_user',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
      new TableForeignKey({
        name: 'FK_shift_created_by',
        columnNames: ['created_by_id'],
        referencedSchema: 'workforce',
        referencedTableName: 'account',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    ]);

    await queryRunner.createIndex(
      'workforce.shift',
      new TableIndex({
        name: 'IDX_shift_start_at',
        columnNames: ['start_at'],
      }),
    );
    await queryRunner.query(`
  CREATE EXTENSION IF NOT EXISTS btree_gist;
`);

await queryRunner.query(`
  ALTER TABLE "workforce"."shift"
  ADD CONSTRAINT "EX_shift_workforce_user_time"
  EXCLUDE USING gist (
    "workforce_user_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  );
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('workforce.shift', true);
  }
}
