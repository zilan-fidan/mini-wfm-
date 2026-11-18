import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RpcException } from '@nestjs/microservices';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderPriority } from './enums/work-order-priority.enum';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { WorkOrdersService } from './work-orders.service';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır.
describe('İş emri listesi (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let service: WorkOrdersService;
  let teamA: Team;
  let teamB: Team;
  const schema = `work_order_list_test_${process.pid}_${Date.now()}`;
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    const entities = [WorkOrder, Team, WorkforceUser, Account];
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
    service = new WorkOrdersService(db.getRepository(WorkOrder), db);

    teamA = await db.getRepository(Team).save({ name: 'Saha A' });
    teamB = await db.getRepository(Team).save({ name: 'Saha B' });
    const account = await db.getRepository(Account).save({ username: 'planner', passwordHash: 'test', role: AccountRole.ADMIN });

    let seq = 0;
    const save = (data: Partial<WorkOrder>) => {
      seq += 1;
      return db.getRepository(WorkOrder).save({
        code: `IE-TEST-${String(seq).padStart(3, '0')}`,
        title: `İş emri ${seq}`,
        priority: WorkOrderPriority.MEDIUM,
        status: WorkOrderStatus.OPEN,
        dueAt: future,
        createdById: account.id,
        // createdAt sırası ekleme sırasıyla aynı olsun
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, seq)),
        ...data,
      });
    };

    // Öncelikler karışık sırada eklenir
    await save({ code: 'IE-TEST-LOW', title: 'Trafo bakımı', priority: WorkOrderPriority.LOW, teamId: teamA.id, dueAt: past });
    await save({ priority: WorkOrderPriority.URGENT, teamId: teamA.id, status: WorkOrderStatus.ASSIGNED, dueAt: past });
    await save({ priority: WorkOrderPriority.MEDIUM, teamId: teamB.id });
    await save({ priority: WorkOrderPriority.HIGH, teamId: teamA.id, status: WorkOrderStatus.IN_PROGRESS });
    await save({ priority: WorkOrderPriority.LOW, title: 'Trafo kontrolü', teamId: teamA.id, dueAt: past });
    // Süresi geçmiş ama kapanmış: isOverdue her zaman false
    await save({ priority: WorkOrderPriority.HIGH, status: WorkOrderStatus.COMPLETED, dueAt: past });
    await save({ priority: WorkOrderPriority.URGENT, status: WorkOrderStatus.CANCELLED, dueAt: past });
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  it('varsayılan sıralama createdAt desc', async () => {
    const result = await service.findAllWorkOrders({});

    expect(result.total).toBe(7);
    expect(result.data.map((wo) => wo.code)).toEqual([
      'IE-TEST-007', 'IE-TEST-006', 'IE-TEST-005', 'IE-TEST-004', 'IE-TEST-003', 'IE-TEST-002', 'IE-TEST-LOW',
    ]);
  });

  it('priority desc önem sırasına göre sıralar (URGENT en üstte), alfabetik değil', async () => {
    const result = await service.findAllWorkOrders({ sortBy: 'priority', sortOrder: 'desc' });

    expect(result.data.map((wo) => wo.priority)).toEqual([
      'URGENT', 'URGENT', 'HIGH', 'HIGH', 'MEDIUM', 'LOW', 'LOW',
    ]);
  });

  it('priority asc LOW ile başlar, URGENT ile biter', async () => {
    const result = await service.findAllWorkOrders({ sortBy: 'priority', sortOrder: 'asc' });
    const priorities = result.data.map((wo) => wo.priority);

    expect(priorities[0]).toBe('LOW');
    expect(priorities.at(-1)).toBe('URGENT');
  });

  it('her kayıtta ekip id ve adı bulunur; ekipsiz kayıtta team null', async () => {
    const result = await service.findAllWorkOrders({ search: 'IE-TEST-LOW' });

    expect(result.data[0].team).toEqual({ id: teamA.id, name: 'Saha A' });

    const unassigned = await service.findAllWorkOrders({ status: [WorkOrderStatus.COMPLETED] });
    expect(unassigned.data[0].team).toBeNull();
  });

  it('isOverdue: süresi geçmiş ve açık olan true, gelecekteki false', async () => {
    const result = await service.findAllWorkOrders({ sortBy: 'createdAt', sortOrder: 'asc' });
    const byCode = Object.fromEntries(result.data.map((wo) => [wo.code, wo.isOverdue]));

    expect(byCode['IE-TEST-LOW']).toBe(true); // OPEN, geçmiş
    expect(byCode['IE-TEST-002']).toBe(true); // ASSIGNED, geçmiş
    expect(byCode['IE-TEST-003']).toBe(false); // gelecekte
    expect(byCode['IE-TEST-004']).toBe(false); // gelecekte
  });

  it('isOverdue kapanmış iş emirlerinde süresi geçmiş olsa bile her zaman false', async () => {
    const result = await service.findAllWorkOrders({
      status: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
    });

    expect(result.total).toBe(2);
    result.data.forEach((wo) => expect(wo.isOverdue).toBe(false));
  });

  it('overdue=true yalnızca süresi geçmiş ve kapanmamış kayıtları döner', async () => {
    const result = await service.findAllWorkOrders({ overdue: true });

    expect(result.total).toBe(3);
    result.data.forEach((wo) => {
      expect(wo.isOverdue).toBe(true);
      expect(['COMPLETED', 'CANCELLED']).not.toContain(wo.status);
    });
  });

  it('search kod veya başlıkta büyük/küçük harf duyarsız arar', async () => {
    expect((await service.findAllWorkOrders({ search: 'trafo' })).total).toBe(2);
    expect((await service.findAllWorkOrders({ search: 'ie-test-low' })).total).toBe(1);
  });

  it('status birden fazla değer alabilir', async () => {
    const result = await service.findAllWorkOrders({
      status: [WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED],
    });

    expect(result.total).toBe(4);
  });

  it('tüm filtreler birlikte kullanılabilir', async () => {
    const result = await service.findAllWorkOrders({
      search: 'trafo',
      status: [WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED],
      priority: WorkOrderPriority.LOW,
      teamId: teamA.id,
      overdue: true,
      sortBy: 'dueAt',
      sortOrder: 'asc',
      page: 1,
      limit: 5,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((wo) => wo.title).sort()).toEqual(['Trafo bakımı', 'Trafo kontrolü']);
  });

  it('sayfalama total değerini değiştirmez', async () => {
    const page1 = await service.findAllWorkOrders({ page: 1, limit: 3 });
    const page3 = await service.findAllWorkOrders({ page: 3, limit: 3 });

    expect(page1.data).toHaveLength(3);
    expect(page3.data).toHaveLength(1);
    expect(page1.total).toBe(7);
    expect(page3.total).toBe(7);
  });

  it('izin verilmeyen sortBy 400 verir ve tablo yerinde kalır', async () => {
    await expect(service.findAllWorkOrders({ sortBy: 'name;DROP TABLE team' })).rejects.toBeInstanceOf(RpcException);
    expect(await db.getRepository(Team).count()).toBe(2);
  });
});
