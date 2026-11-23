import { DataSource, getMetadataArgsStorage, Logger } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RpcException } from '@nestjs/microservices';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderPriority } from './enums/work-order-priority.enum';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { TeamSuggestionsService } from './team-suggestions.service';
import { NO_CAPACITY_REASON } from './calc/team-score';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';
import { Shift } from '../shifts/entities/shift.entity';

// Çalışan SQL sorgularını sayar (schema/sync sorguları sayaç sıfırlandıktan önce biter).
class CountingLogger implements Logger {
  count = 0;
  logQuery() { this.count += 1; }
  logQueryError() {}
  logQuerySlow() {}
  logSchemaBuild() {}
  logMigration() {}
  log() {}
}

const HOUR = 3_600_000;

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır.
describe('Ekip önerisi (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let service: TeamSuggestionsService;
  const logger = new CountingLogger();
  const schema = `team_suggestion_test_${process.pid}_${Date.now()}`;
  const now = new Date('2026-12-01T00:00:00Z');
  const at = (hours: number) => new Date(now.getTime() + hours * HOUR);
  const ids = { normal: 0, urgent: 0, assigned: 0, pastDue: 0 };

  beforeAll(async () => {
    const entities = [WorkOrder, Team, WorkforceUser, Account, Shift];
    const tables = getMetadataArgsStorage().tables.filter((table) => entities.includes(table.target as typeof WorkOrder));
    const originalSchemas = tables.map((table) => table.schema);
    tables.forEach((table) => { table.schema = schema; });
    try {
      db = await new DataSource({
        type: 'postgres',
        url: process.env.WORK_ORDERS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/mini_wfm',
        entities,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['query'],
        logger,
      }).initialize();
    } finally {
      tables.forEach((table, index) => { table.schema = originalSchemas[index]; });
    }
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();
    service = new TeamSuggestionsService(db);

    const account = await db.getRepository(Account).save({ username: 'planner', passwordHash: 'test', role: AccountRole.ADMIN });
    const [a, b, c] = await db.getRepository(Team).save([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    // Pasif ekip: kapasitesi olsa bile ne önerilir ne excluded listesinde görünür
    const passive = await db.getRepository(Team).save({ name: 'Pasif', isActive: false });

    let reg = 0;
    const person = (teamId: number, isActive = true) =>
      db.getRepository(WorkforceUser).save({ firstname: 'P', lastname: String(++reg), registrationNumber: `R${reg}`, teamId, isActive });
    const [a1, a2, b1, b2, b3] = [await person(a.id), await person(a.id), await person(b.id), await person(b.id), await person(b.id)];
    const aInactive = await person(a.id, false);
    await person(c.id); // C'nin aktif üyesi var ama vardiyası yok
    const passiveMember = await person(passive.id);

    const shift = (workforceUserId: number, from: number, to: number) =>
      ({ workforceUserId, startAt: at(from), endAt: at(to), createdById: account.id });
    await db.getRepository(Shift).save([
      // A: 16 saat (−4..+4 vardiyasının yalnızca 4 saati aralıkta; 44..52'nin 4 saati)
      shift(a1.id, -4, 4), shift(a1.id, 44, 52), shift(a2.id, 8, 16),
      // B: 24 saat
      shift(b1.id, 8, 16), shift(b2.id, 16, 24), shift(b3.id, 24, 32),
      // Sayılmayanlar: aralık dışı, pasif üye, pasif ekip
      shift(a2.id, 60, 68), shift(aInactive.id, 0, 8), shift(passiveMember.id, 0, 8),
    ]);

    let seq = 0;
    const workOrder = (data: Partial<WorkOrder>) => db.getRepository(WorkOrder).save({
      code: `IE-TS-${++seq}`, title: `İş ${seq}`, priority: WorkOrderPriority.MEDIUM, status: WorkOrderStatus.OPEN,
      dueAt: at(48), createdById: account.id, ...data,
    });
    // A: 2 açık, 0 geciken; B: 4 açık, 1 geciken
    await workOrder({ teamId: a.id, status: WorkOrderStatus.ASSIGNED });
    await workOrder({ teamId: a.id, status: WorkOrderStatus.IN_PROGRESS });
    await workOrder({ teamId: b.id, status: WorkOrderStatus.ASSIGNED });
    await workOrder({ teamId: b.id, status: WorkOrderStatus.ASSIGNED });
    await workOrder({ teamId: b.id, status: WorkOrderStatus.IN_PROGRESS });
    await workOrder({ teamId: b.id, status: WorkOrderStatus.ASSIGNED, dueAt: at(-24) });
    // Kapanmış iş emirleri iş yükü sayılmaz
    await workOrder({ teamId: a.id, status: WorkOrderStatus.COMPLETED, dueAt: at(-24) });
    await workOrder({ teamId: a.id, status: WorkOrderStatus.CANCELLED, dueAt: at(-24) });

    ids.normal = (await workOrder({ priority: WorkOrderPriority.MEDIUM })).id;
    ids.urgent = (await workOrder({ priority: WorkOrderPriority.URGENT })).id;
    // 409 testi için; C kapasitesiz olduğundan puanları etkilemez
    ids.assigned = (await workOrder({ teamId: c.id, status: WorkOrderStatus.ASSIGNED, dueAt: at(72) })).id;
    ids.pastDue = (await workOrder({ dueAt: at(-1) })).id;
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  const summary = async (id: number) =>
    (await service.suggestTeams(id, now)).suggestions.map((s) => [s.teamName, s.totalScore]);

  it('normal iş emri: A 22, B 18', async () => {
    expect(await summary(ids.normal)).toEqual([['A', 22], ['B', 18]]);
  });

  it('URGENT iş emri: B 66, A 54', async () => {
    expect(await summary(ids.urgent)).toEqual([['B', 66], ['A', 54]]);
  });

  it('C kapasitesiz olarak excluded; pasif ekip hiçbir listede yok', async () => {
    const result = await service.suggestTeams(ids.normal, now);
    expect(result.excluded).toEqual([{ teamId: expect.any(Number), teamName: 'C', reason: NO_CAPACITY_REASON }]);
    expect(result.window).toEqual({ from: now, to: at(48) });
  });

  it('veriyi en fazla 4 sorguyla okur', async () => {
    logger.count = 0;
    await service.suggestTeams(ids.normal, now);
    expect(logger.count).toBeLessThanOrEqual(4);
  });

  it('dueAt geçmişteyse bütün ekipler kapasitesiz', async () => {
    const result = await service.suggestTeams(ids.pastDue, now);
    expect(result.suggestions).toEqual([]);
    expect(result.excluded.map((e) => e.teamName)).toEqual(['A', 'B', 'C']);
  });

  it('OPEN olmayan iş emri → 409', async () => {
    await expect(service.suggestTeams(ids.assigned, now)).rejects.toMatchObject({
      error: { statusCode: 409 },
    });
  });

  it('olmayan iş emri → 404', async () => {
    const error = await service.suggestTeams(999_999, now).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).getError()).toMatchObject({ statusCode: 404 });
  });
});
