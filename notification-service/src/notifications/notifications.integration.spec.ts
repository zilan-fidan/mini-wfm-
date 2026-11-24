import { randomUUID } from 'node:crypto';
import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RmqContext } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { WORK_ORDER_ASSIGNED, WorkOrderAssignedEvent } from '../common/events/work-order-events';
import { Notification } from './entities/notification.entity';
import { NotificationEventsController } from './notification-events.controller';
import { NotificationsService } from './notifications.service';

const assignedEvent = (overrides: Partial<WorkOrderAssignedEvent> = {}): WorkOrderAssignedEvent => ({
  eventId: randomUUID(),
  eventType: WORK_ORDER_ASSIGNED,
  eventVersion: 1,
  occurredAt: new Date().toISOString(),
  correlationId: 'test-correlation',
  workOrder: { id: 1, code: 'IE-0001', title: 'Arıza', version: 2, priority: 'HIGH', dueAt: new Date().toISOString() },
  team: { id: 3, name: 'Saha Ekibi' },
  members: [
    { id: 11, firstname: 'Ada', lastname: 'Yılmaz' },
    { id: 12, firstname: 'Ali', lastname: 'Demir' },
  ],
  assignedById: 1,
  ...overrides,
});

const rmqContext = () => {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { content: Buffer.from('') };
  return { channel, context: new RmqContext([message, channel, WORK_ORDER_ASSIGNED]) };
};

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır.
describe('Bildirim idempotency (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let service: NotificationsService;
  const schema = `notification_test_${process.pid}_${Date.now()}`;

  const countFor = (eventId: string) => db.getRepository(Notification).countBy({ eventId });

  beforeAll(async () => {
    const table = getMetadataArgsStorage().tables.find((t) => t.target === Notification)!;
    const originalSchema = table.schema;
    table.schema = schema;
    try {
      db = await new DataSource({
        type: 'postgres',
        url:
          process.env.NOTIFICATIONS_TEST_DATABASE_URL ??
          'postgres://postgres:postgres@127.0.0.1:5433/mini_wfm',
        entities: [Notification],
        namingStrategy: new SnakeNamingStrategy(),
      }).initialize();
    } finally {
      table.schema = originalSchema;
    }
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();
    service = new NotificationsService(db.getRepository(Notification));
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  it('ekibin her üyesi için bir bildirim oluşturur', async () => {
    const event = assignedEvent();

    await expect(service.createForWorkOrderAssigned(event)).resolves.toEqual({ created: 2, duplicate: 0 });

    const rows = await db.getRepository(Notification).find({ where: { eventId: event.eventId }, order: { workforceUserId: 'ASC' } });
    expect(rows.map((r) => r.workforceUserId)).toEqual([11, 12]);
    expect(rows[0]).toMatchObject({ type: 'WORK_ORDER_ASSIGNED', title: 'Ekibinize iş emri atandı: IE-0001' });
  });

  it('aynı eventId ikinci kez gelirse yeni bildirim oluşturulmaz', async () => {
    const event = assignedEvent();

    await service.createForWorkOrderAssigned(event);
    await expect(service.createForWorkOrderAssigned(event)).resolves.toEqual({ created: 0, duplicate: 2 });

    expect(await countFor(event.eventId)).toBe(2);
  });

  it('aynı olay eşzamanlı iki kez işlense de bildirimler bir kez oluşur', async () => {
    const event = assignedEvent();

    const results = await Promise.all([
      service.createForWorkOrderAssigned(event),
      service.createForWorkOrderAssigned(event),
    ]);

    expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(2);
    expect(await countFor(event.eventId)).toBe(2);
  });

  it('kuyruktan aynı mesaj iki kez teslim edilirse ikisi de ack\'lenir, bildirim bir kez yazılır', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const controller = new NotificationEventsController(service);
    const event = assignedEvent();
    const first = rmqContext();
    const redelivery = rmqContext();

    await controller.onWorkOrderAssigned(event, first.context);
    await controller.onWorkOrderAssigned(event, redelivery.context);

    expect(first.channel.ack).toHaveBeenCalledTimes(1);
    expect(redelivery.channel.ack).toHaveBeenCalledTimes(1);
    expect(redelivery.channel.nack).not.toHaveBeenCalled();
    expect(await countFor(event.eventId)).toBe(2);
    jest.restoreAllMocks();
  });

  it('farklı eventId ile gelen yeni atama yeni bildirim üretir', async () => {
    const members = [{ id: 21, firstname: 'Can', lastname: 'Kaya' }];

    await service.createForWorkOrderAssigned(assignedEvent({ members }));
    await service.createForWorkOrderAssigned(assignedEvent({ members }));

    expect(await db.getRepository(Notification).countBy({ workforceUserId: 21 })).toBe(2);
  });
});
