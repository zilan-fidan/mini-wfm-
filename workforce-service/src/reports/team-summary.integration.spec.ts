import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RpcException } from '@nestjs/microservices';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';
import { Shift } from '../shifts/entities/shift.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderStatusHistory } from '../work-orders/entities/work-order-status-history.entity';
import { WorkOrderStatus } from '../work-orders/enums/work-order-status.enum';
import { WorkOrderPriority } from '../work-orders/enums/work-order-priority.enum';
import { TeamSummaryService } from './team-summary.service';

/*
 * Bilinen veri seti (aralık: 2026-11-01T00:00Z → 2026-11-08T00:00Z, "şimdi": 2026-11-05T00:00Z)
 *
 * Alfa ekibi: a1, a2 aktif; a3 pasif → aktif üye 2
 *   İş emirleri (dueAt):
 *     OPEN        11-02  → gecikmiş
 *     ASSIGNED    11-01 00:00 (tam from, dahil) → gecikmiş
 *     ASSIGNED    11-06  → henüz değil
 *     IN_PROGRESS 11-03  → gecikmiş
 *     COMPLETED   11-02  → kapalı, gecikmiş sayılmaz
 *     CANCELLED   11-04  → kapalı
 *     OPEN        11-08 00:00 (tam to, hariç)
 *     OPEN        11-09  (aralık dışı)
 *   → OPEN 1, ASSIGNED 2, IN_PROGRESS 1, COMPLETED 1, CANCELLED 1, overdue 3
 *   Vardiyalar:
 *     a1 11-02 08:00–16:00          → 8 saat
 *     a1 10-31 20:00–11-01 04:00    → 8 saatin 4'ü aralıkta
 *     a2 11-07 20:00–11-08 06:00    → 10 saatin 4'ü aralıkta
 *     a3 11-03 09:00–12:00 (pasif)  → 3 saat (çalışılmış saat, sayılır)
 *     a1 11-10 08:00–16:00          → aralık dışı
 *   → 19 saat
 *
 * Beta ekibi: b1 aktif → 1 üye; COMPLETED 11-05 → 1; vardiya 11-04 10:00–11:30 → 1.5 saat
 * Boş ekip: üye, iş emri, vardiya yok → hepsi 0
 * Ekipsiz personel ve ekipsiz iş emri hiçbir ekibe yazılmaz.
 */
describe('Ekip özet raporu (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let service: TeamSummaryService;
  let alfa: Team;
  let beta: Team;
  let empty: Team;
  let accountId: number;
  const schema = `team_summary_test_${process.pid}_${Date.now()}`;
  const range = { from: '2026-11-01T00:00:00Z', to: '2026-11-08T00:00:00Z' };
  const now = new Date('2026-11-05T00:00:00Z');
  let seq = 0;

  const workOrder = (teamId: number | null, status: WorkOrderStatus, dueAt: string) => {
    seq += 1;
    return db.getRepository(WorkOrder).save({
      code: `IE-RPT-${String(seq).padStart(3, '0')}`,
      title: `Rapor iş emri ${seq}`,
      priority: WorkOrderPriority.MEDIUM,
      status,
      teamId,
      dueAt: new Date(dueAt),
      createdById: accountId,
    });
  };

  const shift = (workforceUserId: number, startAt: string, endAt: string) =>
    db.getRepository(Shift).save({
      workforceUserId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      createdById: accountId,
    });

  const rowOf = async (team: Team) => {
    const report = await service.getTeamSummary(range, now);
    return report.teams.find((t) => t.teamId === team.id);
  };

  beforeAll(async () => {
    const entities = [Team, WorkforceUser, Account, Shift, WorkOrder, WorkOrderStatusHistory];
    const tables = getMetadataArgsStorage().tables.filter((t) => entities.includes(t.target as typeof Team));
    const originalSchemas = tables.map((t) => t.schema);
    tables.forEach((t) => { t.schema = schema; });
    try {
      db = await new DataSource({
        type: 'postgres',
        url: process.env.REPORTS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/mini_wfm',
        entities,
        namingStrategy: new SnakeNamingStrategy(),
      }).initialize();
    } finally {
      tables.forEach((t, i) => { t.schema = originalSchemas[i]; });
    }
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();
    service = new TeamSummaryService(db);

    accountId = (await db.getRepository(Account).save({ username: 'planner', passwordHash: 'x', role: AccountRole.ADMIN })).id;
    [alfa, beta, empty] = await db.getRepository(Team).save([{ name: 'Alfa' }, { name: 'Beta' }, { name: 'Boş ekip' }]);

    const [a1, a2, a3, b1, loner] = await db.getRepository(WorkforceUser).save([
      { firstname: 'A', lastname: 'Bir', registrationNumber: 'RPT-A1', teamId: alfa.id, isActive: true },
      { firstname: 'A', lastname: 'İki', registrationNumber: 'RPT-A2', teamId: alfa.id, isActive: true },
      { firstname: 'A', lastname: 'Üç', registrationNumber: 'RPT-A3', teamId: alfa.id, isActive: false },
      { firstname: 'B', lastname: 'Bir', registrationNumber: 'RPT-B1', teamId: beta.id, isActive: true },
      { firstname: 'Ekipsiz', lastname: 'Kişi', registrationNumber: 'RPT-U1', teamId: null, isActive: true },
    ]);

    await workOrder(alfa.id, WorkOrderStatus.OPEN, '2026-11-02T10:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.ASSIGNED, '2026-11-01T00:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.ASSIGNED, '2026-11-06T10:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.IN_PROGRESS, '2026-11-03T10:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.COMPLETED, '2026-11-02T10:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.CANCELLED, '2026-11-04T10:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.OPEN, '2026-11-08T00:00:00Z');
    await workOrder(alfa.id, WorkOrderStatus.OPEN, '2026-11-09T10:00:00Z');
    await workOrder(beta.id, WorkOrderStatus.COMPLETED, '2026-11-05T10:00:00Z');
    await workOrder(null, WorkOrderStatus.OPEN, '2026-11-02T10:00:00Z');

    await shift(a1.id, '2026-11-02T08:00:00Z', '2026-11-02T16:00:00Z');
    await shift(a1.id, '2026-10-31T20:00:00Z', '2026-11-01T04:00:00Z');
    await shift(a2.id, '2026-11-07T20:00:00Z', '2026-11-08T06:00:00Z');
    await shift(a3.id, '2026-11-03T09:00:00Z', '2026-11-03T12:00:00Z');
    await shift(a1.id, '2026-11-10T08:00:00Z', '2026-11-10T16:00:00Z');
    await shift(b1.id, '2026-11-04T10:00:00Z', '2026-11-04T11:30:00Z');
    await shift(loner.id, '2026-11-02T08:00:00Z', '2026-11-02T16:00:00Z');
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  it('her ekip için bir satır döner, aralığı ISO olarak yansıtır', async () => {
    const report = await service.getTeamSummary(range, now);

    expect(report.from).toBe('2026-11-01T00:00:00.000Z');
    expect(report.to).toBe('2026-11-08T00:00:00.000Z');
    expect(report.teams.map((t) => t.teamId)).toEqual([alfa.id, beta.id, empty.id]);
  });

  it('Alfa: durum sayıları, gecikenler, aktif üye ve kırpılmış vardiya saati', async () => {
    expect(await rowOf(alfa)).toEqual({
      teamId: alfa.id,
      teamName: 'Alfa',
      activeMemberCount: 2,
      workOrders: { OPEN: 1, ASSIGNED: 2, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1, overdue: 3 },
      shiftHours: 19,
    });
  });

  it('Beta: küsuratlı vardiya saati doğru toplanır', async () => {
    expect(await rowOf(beta)).toEqual({
      teamId: beta.id,
      teamName: 'Beta',
      activeMemberCount: 1,
      workOrders: { OPEN: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 1, CANCELLED: 0, overdue: 0 },
      shiftHours: 1.5,
    });
  });

  it('hiç verisi olmayan ekip 0 değerleriyle listede yer alır', async () => {
    expect(await rowOf(empty)).toEqual({
      teamId: empty.id,
      teamName: 'Boş ekip',
      activeMemberCount: 0,
      workOrders: { OPEN: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0, overdue: 0 },
      shiftHours: 0,
    });
  });

  it('kısmen aralığa giren vardiyada yalnızca aralık içindeki saatler sayılır', async () => {
    // Yalnızca 11-01 günü: a1'in gece vardiyasının 00:00–04:00 kısmı → 4 saat
    const report = await service.getTeamSummary({ from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' }, now);
    expect(report.teams.find((t) => t.teamId === alfa.id)?.shiftHours).toBe(4);
  });

  it('rapor ekip sayısından bağımsız olarak tek sorguyla üretilir', async () => {
    const spy = jest.spyOn(db.logger, 'logQuery');
    try {
      await service.getTeamSummary(range, now);
      const before = spy.mock.calls.length;

      await db.getRepository(Team).save(Array.from({ length: 20 }, (_, i) => ({ name: `Ek ekip ${i}` })));
      spy.mockClear();

      const report = await service.getTeamSummary(range, now);
      expect(report.teams).toHaveLength(23);
      expect(before).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it.each([
    {},
    { from: '2026-11-01T00:00:00Z' },
    { from: 'dün', to: '2026-11-02T00:00:00Z' },
    { from: '2026-11-02T00:00:00Z', to: '2026-11-01T00:00:00Z' },
    { from: '2026-11-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
    { from: '2026-11-01T00:00:00Z', to: '2026-12-02T00:00:01Z' },
  ])('geçersiz aralık 400 ile reddedilir: %j', async (query) => {
    await expect(service.getTeamSummary(query as never, now)).rejects.toBeInstanceOf(RpcException);
  });

  it('tam 31 günlük aralık kabul edilir', async () => {
    await expect(service.getTeamSummary({ from: '2026-11-01T00:00:00Z', to: '2026-12-02T00:00:00Z' }, now)).resolves.toBeDefined();
  });
});
