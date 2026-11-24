import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RpcException } from '@nestjs/microservices';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderStatusHistory } from './entities/work-order-status-history.entity';
import { WorkOrderPriority } from './enums/work-order-priority.enum';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderEventsPublisher } from '../events/work-order-events.publisher';
import { WORK_ORDER_ASSIGNED, WORK_ORDER_STATUS_CHANGED, WorkOrderEventDraft } from '../events/work-order-events';
import { WORK_ORDER_VERSION_CONFLICT_MESSAGE } from './constants/work-order-errors';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';

const rpcError = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as RpcException).getError() as { statusCode: number; message: string };
  }
  throw new Error('Hata bekleniyordu');
};

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır.
describe('İş emri optimistic locking (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let service: WorkOrdersService;
  let accountId: number;
  const publish = jest.fn<void, [WorkOrderEventDraft[]]>();
  const schema = `work_order_version_test_${process.pid}_${Date.now()}`;
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let seq = 0;

  const createWorkOrder = () => {
    seq += 1;
    return db.getRepository(WorkOrder).save({
      code: `IE-VER-${String(seq).padStart(3, '0')}`,
      title: `İş emri ${seq}`,
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.OPEN,
      dueAt: future,
      createdById: accountId,
    });
  };

  const reload = (id: number) => db.getRepository(WorkOrder).findOneByOrFail({ id });

  beforeAll(async () => {
    const entities = [WorkOrder, WorkOrderStatusHistory, Team, WorkforceUser, Account];
    const tables = getMetadataArgsStorage().tables.filter((table) => entities.includes(table.target as typeof WorkOrder));
    const originalSchemas = tables.map((table) => table.schema);
    tables.forEach((table) => { table.schema = schema; });
    try {
      db = await new DataSource({
        type: 'postgres',
        url: process.env.WORK_ORDERS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/mini_wfm',
        entities,
        namingStrategy: new SnakeNamingStrategy(),
      }).initialize();
    } finally {
      tables.forEach((table, index) => { table.schema = originalSchemas[index]; });
    }
    // synchronize enum tiplerini şemadan önce kurmaya çalışır; şema önceden açılmalı
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();
    service = new WorkOrdersService(
      db.getRepository(WorkOrder),
      db,
      { publish } as unknown as WorkOrderEventsPublisher,
    );

    const account = await db.getRepository(Account).save({ username: 'planner', passwordHash: 'test', role: AccountRole.ADMIN });
    accountId = account.id;
  });

  beforeEach(() => publish.mockReset());

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  it('her başarılı güncellemede version tam olarak bir artar ve yanıtta döner', async () => {
    const wo = await createWorkOrder();
    expect(wo.version).toBe(1);

    const first = await service.updateWorkOrder(wo.id, 1, { title: 'Birinci' });
    expect(first.version).toBe(2);

    const second = await service.updateWorkOrder(wo.id, 2, { title: 'İkinci' });
    expect(second.version).toBe(3);
    expect(second.title).toBe('İkinci');

    expect((await reload(wo.id)).version).toBe(3);
  });

  it('eski version ile güncelleme 409 alır ve diğer planlamacının işini ezmez', async () => {
    const wo = await createWorkOrder();

    // İki planlamacı da kaydı version=1 iken okudu. A önce kaydetti.
    await service.updateWorkOrder(wo.id, 1, { title: 'Planlamacı A' });

    // hâlâ version=1 ile gönderiyor
    const error = await rpcError(service.updateWorkOrder(wo.id, 1, { title: 'Planlamacı B' }));
    expect(error).toEqual({ statusCode: 409, message: WORK_ORDER_VERSION_CONFLICT_MESSAGE });

    const current = await reload(wo.id);
    expect(current.title).toBe('Planlamacı A');
    expect(current.version).toBe(2);
  });

  it('aynı version ile eşzamanlı iki güncellemeden yalnızca biri başarılı olur', async () => {
    const wo = await createWorkOrder();

    const results = await Promise.allSettled([
      service.updateWorkOrder(wo.id, 1, { title: 'Eşzamanlı A' }),
      service.updateWorkOrder(wo.id, 1, { title: 'Eşzamanlı B' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as RpcException).getError()).toMatchObject({ statusCode: 409 });

    const current = await reload(wo.id);
    expect(current.version).toBe(2);
    expect(current.title).toBe((fulfilled[0] as PromiseFulfilledResult<WorkOrder>).value.title);
  });

  it('olmayan iş emri için 404 döner (409 değil)', async () => {
    const error = await rpcError(service.updateWorkOrder(999999, 1, { title: 'Yok' }));
    expect(error.statusCode).toBe(404);
  });

  it('durum değişikliği de version artırır', async () => {
    const wo = await createWorkOrder();

    const result = await service.changeWorkOrderStatus(
      wo.id, WorkOrderStatus.CANCELLED, null, 'Gerek kalmadı', accountId, 'ADMIN', 1,
    );

    expect(result.status).toBe(WorkOrderStatus.CANCELLED);
    expect(result.version).toBe(2);
  });

  it('eski version ile durum değişikliği 409 alır ve geçmiş kaydı yazılmaz', async () => {
    const wo = await createWorkOrder();
    await service.updateWorkOrder(wo.id, 1, { title: 'Araya giren değişiklik' });

    const error = await rpcError(
      service.changeWorkOrderStatus(wo.id, WorkOrderStatus.CANCELLED, null, 'İptal', accountId, 'ADMIN', 1),
    );
    expect(error).toEqual({ statusCode: 409, message: WORK_ORDER_VERSION_CONFLICT_MESSAGE });

    const current = await reload(wo.id);
    expect(current.status).toBe(WorkOrderStatus.OPEN);
    expect(current.version).toBe(2);
    expect(await db.getRepository(WorkOrderStatusHistory).countBy({ workOrderId: wo.id })).toBe(0);
  });

  describe('olay yayını (B22)', () => {
    let teamId: number;
    let activeIds: number[];

    beforeAll(async () => {
      const team = await db.getRepository(Team).save({ name: 'Olay Ekibi' });
      teamId = team.id;
      const users = await db.getRepository(WorkforceUser).save([
        { firstname: 'Ada', lastname: 'Yılmaz', registrationNumber: 'EV-001', teamId, isActive: true },
        { firstname: 'Ali', lastname: 'Demir', registrationNumber: 'EV-002', teamId, isActive: true },
        { firstname: 'Pasif', lastname: 'Üye', registrationNumber: 'EV-003', teamId, isActive: false },
      ]);
      activeIds = users.filter((u) => u.isActive).map((u) => u.id);
    });

    it('ASSIGNED geçişi commit edildikten sonra iki olay yayınlanır; üye listesi yalnızca aktif üyeler', async () => {
      const wo = await createWorkOrder();
      let statusSeenByPublisher: Promise<WorkOrderStatus> | undefined;
      // publish çağrıldığı anda başka bir bağlantıdan okunan durum commit edilmiş olmalı
      publish.mockImplementation(() => {
        statusSeenByPublisher = reload(wo.id).then((w) => w.status);
      });

      await service.changeWorkOrderStatus(wo.id, WorkOrderStatus.ASSIGNED, teamId, null, accountId, 'ADMIN', 1);

      expect(publish).toHaveBeenCalledTimes(1);
      await expect(statusSeenByPublisher).resolves.toBe(WorkOrderStatus.ASSIGNED);

      const [changed, assigned] = publish.mock.calls[0][0];
      expect(changed).toMatchObject({
        eventType: WORK_ORDER_STATUS_CHANGED,
        workOrder: { id: wo.id, code: wo.code, version: 2 },
        fromStatus: WorkOrderStatus.OPEN,
        toStatus: WorkOrderStatus.ASSIGNED,
        teamId,
        changedById: accountId,
      });
      expect(assigned).toMatchObject({
        eventType: WORK_ORDER_ASSIGNED,
        team: { id: teamId, name: 'Olay Ekibi' },
        assignedById: accountId,
      });
      expect(assigned.eventType === WORK_ORDER_ASSIGNED && assigned.members.map((m) => m.id)).toEqual(activeIds);
    });

    it('ASSIGNED dışındaki geçişte yalnızca workOrderStatusChanged yayınlanır', async () => {
      const wo = await createWorkOrder();

      await service.changeWorkOrderStatus(wo.id, WorkOrderStatus.CANCELLED, null, 'İptal', accountId, 'ADMIN', 1);

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish.mock.calls[0][0].map((e) => e.eventType)).toEqual([WORK_ORDER_STATUS_CHANGED]);
    });

    it('geri alınan işlem için olay yayınlanmaz', async () => {
      const wo = await createWorkOrder();

      // Olmayan hesap id'si geçmiş kaydında FK hatası verir → tüm transaction rollback
      await expect(
        service.changeWorkOrderStatus(wo.id, WorkOrderStatus.ASSIGNED, teamId, null, 999999, 'ADMIN', 1),
      ).rejects.toThrow();

      expect(publish).not.toHaveBeenCalled();
      const current = await reload(wo.id);
      expect(current.status).toBe(WorkOrderStatus.OPEN);
      expect(current.teamId).toBeNull();
    });

    it('iş kuralı hatasında (409) olay yayınlanmaz', async () => {
      const wo = await createWorkOrder();

      await rpcError(service.changeWorkOrderStatus(wo.id, WorkOrderStatus.COMPLETED, null, null, accountId, 'ADMIN', 1));

      expect(publish).not.toHaveBeenCalled();
    });
  });
});
