import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { WorkOrder } from '../entities/work-order.entity';
import { WorkOrderStatusHistory } from '../entities/work-order-status-history.entity';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { WorkOrdersService } from '../work-orders.service';
import { Team } from '../../teams/entities/team.entity';
import { WorkforceUser } from '../../workforce-users/entities/workforce-user.entity';
import { Account } from '../../account/entities/account.entity';
import { AccountRole } from '../../account/entities/account-role.enum';
import { WorkOrderEventsPublisher } from '../../events/work-order-events.publisher';
import { WORK_ORDER_OVERDUE } from '../../events/work-order-events';
import { OverdueWorkOrdersService, overdueEventId } from './overdue-work-orders.service';

const HOUR = 60 * 60 * 1000;

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır.
describe('Geciken iş emri sahiplenme (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let overdue: OverdueWorkOrdersService;
  let workOrders: WorkOrdersService;
  let accountId: number;
  let teamId: number;
  let activeIds: number[];
  const schema = `overdue_test_${process.pid}_${Date.now()}`;
  let seq = 0;

  const createWorkOrder = (dueAt: Date, status = WorkOrderStatus.OPEN, team: number | null = null) => {
    seq += 1;
    return db.getRepository(WorkOrder).save({
      code: `IE-OVD-${String(seq).padStart(3, '0')}`,
      title: `İş emri ${seq}`,
      priority: WorkOrderPriority.HIGH,
      status,
      teamId: team,
      dueAt,
      createdById: accountId,
    });
  };

  const reload = (id: number) => db.getRepository(WorkOrder).findOneByOrFail({ id });
  // Her test kendi kayıtlarına bakar: önceki testlerden kalan geciken kayıtlar sonucu karıştırmasın
  const claimedIds = async (now = new Date()) => (await overdue.claimOverdue(now)).map((c) => c.workOrderId);

  beforeAll(async () => {
    const entities = [WorkOrder, WorkOrderStatusHistory, Team, WorkforceUser, Account];
    const tables = getMetadataArgsStorage().tables.filter((t) => entities.includes(t.target as typeof WorkOrder));
    const originalSchemas = tables.map((t) => t.schema);
    tables.forEach((t) => { t.schema = schema; });
    try {
      db = await new DataSource({
        type: 'postgres',
        url: process.env.WORK_ORDERS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/mini_wfm',
        entities,
        namingStrategy: new SnakeNamingStrategy(),
        // İki kopya testi için en az iki bağlantı
        extra: { max: 5 },
      }).initialize();
    } finally {
      tables.forEach((t, i) => { t.schema = originalSchemas[i]; });
    }
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();

    overdue = new OverdueWorkOrdersService(db);
    workOrders = new WorkOrdersService(db.getRepository(WorkOrder), db, { publish: jest.fn() } as unknown as WorkOrderEventsPublisher);

    accountId = (await db.getRepository(Account).save({ username: 'planner', passwordHash: 'x', role: AccountRole.ADMIN })).id;
    teamId = (await db.getRepository(Team).save({ name: 'Gecikme Ekibi' })).id;
    const users = await db.getRepository(WorkforceUser).save([
      { firstname: 'Ada', lastname: 'Yılmaz', registrationNumber: 'OV-001', teamId, isActive: true },
      { firstname: 'Ali', lastname: 'Demir', registrationNumber: 'OV-002', teamId, isActive: true },
      { firstname: 'Pasif', lastname: 'Üye', registrationNumber: 'OV-003', teamId, isActive: false },
    ]);
    activeIds = users.filter((u) => u.isActive).map((u) => u.id);
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  // Her testten önce kalan bütün geciken kayıtları temizle
  beforeEach(() => overdue.claimOverdue(new Date(Date.now() + 1000 * HOUR), 10_000));

  it('süresi geçmiş iş emri bir kez sahiplenilir; sonraki çalışmalarda gelmez', async () => {
    const wo = await createWorkOrder(new Date(Date.now() - HOUR), WorkOrderStatus.ASSIGNED, teamId);

    expect(await claimedIds()).toEqual([wo.id]);
    expect(await claimedIds()).toEqual([]);
    expect(await claimedIds()).toEqual([]);
    expect((await reload(wo.id)).overdueNotifiedAt).not.toBeNull();
  });

  it('olay taslağı ekip ve yalnızca aktif üyeleri taşır; eventId iş emri + dueAt\'ten türetilir', async () => {
    const dueAt = new Date(Date.now() - HOUR);
    const wo = await createWorkOrder(dueAt, WorkOrderStatus.IN_PROGRESS, teamId);

    const [claim] = await overdue.claimOverdue();

    expect(claim.eventId).toBe(overdueEventId(wo.id, dueAt));
    expect(claim.draft).toMatchObject({
      eventType: WORK_ORDER_OVERDUE,
      workOrder: { id: wo.id, code: wo.code, status: WorkOrderStatus.IN_PROGRESS, dueAt: dueAt.toISOString() },
      team: { id: teamId, name: 'Gecikme Ekibi' },
    });
    expect(claim.draft.eventType === WORK_ORDER_OVERDUE && claim.draft.members.map((m) => m.id)).toEqual(activeIds);
  });

  it('kapanmış ve süresi gelmemiş iş emirleri sahiplenilmez', async () => {
    const past = new Date(Date.now() - HOUR);
    await createWorkOrder(past, WorkOrderStatus.COMPLETED, teamId);
    await createWorkOrder(past, WorkOrderStatus.CANCELLED, teamId);
    await createWorkOrder(new Date(Date.now() + HOUR), WorkOrderStatus.ASSIGNED, teamId);

    expect(await claimedIds()).toEqual([]);
  });

  it('ekipsiz geciken iş emri de bir kez yayınlanır; üye listesi boş', async () => {
    const wo = await createWorkOrder(new Date(Date.now() - HOUR));

    const [claim] = await overdue.claimOverdue();

    expect(claim.workOrderId).toBe(wo.id);
    expect(claim.draft).toMatchObject({ team: null, members: [] });
  });

  it('sahiplenme version ve updatedAt değerini değiştirmez (kullanıcı 409 almaz)', async () => {
    const wo = await createWorkOrder(new Date(Date.now() - HOUR));

    await overdue.claimOverdue();

    const after = await reload(wo.id);
    expect(after.version).toBe(wo.version);
    expect(after.updatedAt.getTime()).toBe(wo.updatedAt.getTime());
  });

  it('servisin iki kopyası aynı anda çalışsa da her iş emri tek kopyaya düşer', async () => {
    const created = await Promise.all(
      Array.from({ length: 20 }, () => createWorkOrder(new Date(Date.now() - HOUR), WorkOrderStatus.ASSIGNED, teamId)),
    );

    const [a, b] = await Promise.all([overdue.claimOverdue(), overdue.claimOverdue()]);
    const all = [...a, ...b].map((c) => c.workOrderId);

    expect(new Set(all).size).toBe(all.length);
    expect(all.sort((x, y) => x - y)).toEqual(created.map((w) => w.id).sort((x, y) => x - y));
  });

  it('dueAt ileri alınınca işaret sıfırlanır; yeni süre geçince yeni eventId ile tekrar bildirilir', async () => {
    const firstDue = new Date(Date.now() - HOUR);
    const wo = await createWorkOrder(firstDue, WorkOrderStatus.ASSIGNED, teamId);
    const [first] = await overdue.claimOverdue();

    const newDue = new Date(Date.now() + 2 * HOUR);
    await workOrders.updateWorkOrder(wo.id, wo.version, { dueAt: newDue });
    expect((await reload(wo.id)).overdueNotifiedAt).toBeNull();

    // Yeni süre henüz gelmedi
    expect(await claimedIds()).toEqual([]);

    // 3 saat sonra
    const [second] = await overdue.claimOverdue(new Date(Date.now() + 3 * HOUR));
    expect(second.workOrderId).toBe(wo.id);
    expect(second.eventId).not.toBe(first.eventId);
  });

  it('dueAt dışında bir alan güncellenirse işaret korunur', async () => {
    const wo = await createWorkOrder(new Date(Date.now() - HOUR));
    await overdue.claimOverdue();

    await workOrders.updateWorkOrder(wo.id, wo.version, { title: 'Yeni başlık' });

    expect((await reload(wo.id)).overdueNotifiedAt).not.toBeNull();
    expect(await claimedIds()).toEqual([]);
  });

  it('yayın başarısız olunca geri alınan kayıt sonraki çalışmada aynı eventId ile gelir', async () => {
    const wo = await createWorkOrder(new Date(Date.now() - HOUR));
    const [claim] = await overdue.claimOverdue();

    await overdue.releaseClaim(claim.workOrderId, claim.claimedAt);

    const [retry] = await overdue.claimOverdue();
    expect(retry.workOrderId).toBe(wo.id);
    expect(retry.eventId).toBe(claim.eventId);
  });

  it('geri alma, başka bir çalışmanın daha yeni sahiplenmesine dokunmaz', async () => {
    const wo = await createWorkOrder(new Date(Date.now() - HOUR));
    const [stale] = await overdue.claimOverdue();
    await overdue.releaseClaim(stale.workOrderId, stale.claimedAt);
    const [fresh] = await overdue.claimOverdue(new Date(Date.now() + 1000));

    // Eski çalışmanın geç kalan geri alması
    await overdue.releaseClaim(stale.workOrderId, stale.claimedAt);

    expect((await reload(wo.id)).overdueNotifiedAt?.getTime()).toBe(fresh.claimedAt.getTime());
  });
});
