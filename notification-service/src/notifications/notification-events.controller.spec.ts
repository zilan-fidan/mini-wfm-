import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { WORK_ORDER_ASSIGNED, WORK_ORDER_OVERDUE, WORK_ORDER_STATUS_CHANGED } from '../common/events/work-order-events';
import { handleWithManualAck } from './manual-ack';
import { NotificationEventsController } from './notification-events.controller';
import { NotificationsService } from './notifications.service';

const assigned = () => ({
  eventId: randomUUID(),
  eventType: WORK_ORDER_ASSIGNED,
  eventVersion: 1,
  occurredAt: '2026-11-23T10:00:00.000Z',
  correlationId: 'abc-123',
  workOrder: { id: 7, code: 'IE-0007', title: 'Arıza', version: 2, priority: 'HIGH', dueAt: '2026-12-01T00:00:00.000Z' },
  team: { id: 3, name: 'Saha' },
  members: [{ id: 11, firstname: 'Ada', lastname: 'Yılmaz' }],
  assignedById: 1,
});

const rmqContext = () => {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { content: Buffer.from('') };
  return { channel, message, context: new RmqContext([message, channel, WORK_ORDER_ASSIGNED]) };
};

describe('NotificationEventsController (manuel ack)', () => {
  let service: { createForWorkOrderAssigned: jest.Mock; createForWorkOrderOverdue: jest.Mock };
  let controller: NotificationEventsController;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    service = {
      createForWorkOrderAssigned: jest.fn().mockResolvedValue({ created: 1, duplicate: 0 }),
      createForWorkOrderOverdue: jest.fn().mockResolvedValue({ created: 1, duplicate: 0 }),
    };
    controller = new NotificationEventsController(service as unknown as NotificationsService);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('bildirim yazıldıktan sonra mesajı ack\'ler ve correlation id\'yi loglar', async () => {
    const { channel, message, context } = rmqContext();
    const event = assigned();

    await controller.onWorkOrderAssigned(event, context);

    expect(service.createForWorkOrderAssigned).toHaveBeenCalledWith(event);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('correlationId=abc-123'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`eventId=${event.eventId}`));
  });

  it('ack, kayıt bitmeden çağrılmaz', async () => {
    const { channel, context } = rmqContext();
    let finishWrite!: () => void;
    service.createForWorkOrderAssigned.mockReturnValue(
      new Promise((resolve) => { finishWrite = () => resolve({ created: 1, duplicate: 0 }); }),
    );

    const handling = controller.onWorkOrderAssigned(assigned(), context);
    await Promise.resolve();
    expect(channel.ack).not.toHaveBeenCalled();

    finishWrite();
    await handling;
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('kayıt yazılamazsa ack\'lenmez; bekledikten sonra kuyruğa geri konur', async () => {
    const { channel, message, context } = rmqContext();
    service.createForWorkOrderAssigned.mockRejectedValue(new Error('db down'));

    const handling = controller.onWorkOrderAssigned(assigned(), context);
    await jest.advanceTimersByTimeAsync(999);
    expect(channel.nack).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await handling;

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('correlationId=abc-123'), expect.any(String));
  });

  it.each([
    ['eventId yok', { ...assigned(), eventId: undefined }],
    ['members dizi değil', { ...assigned(), members: 'x' }],
    ['eventType yanlış', { ...assigned(), eventType: WORK_ORDER_STATUS_CHANGED }],
    ['gövde nesne değil', 'merhaba'],
  ])('geçersiz olay (%s) kuyruğa geri konmadan atılır', async (_, payload) => {
    const { channel, message, context } = rmqContext();

    await controller.onWorkOrderAssigned(payload, context);

    expect(service.createForWorkOrderAssigned).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  describe('workOrderOverdue', () => {
    const overdue = (overrides: Record<string, unknown> = {}) => ({
      eventId: randomUUID(),
      eventType: WORK_ORDER_OVERDUE,
      eventVersion: 1,
      occurredAt: '2026-11-24T10:00:00.000Z',
      correlationId: 'overdue-check-abc',
      workOrder: { id: 9, code: 'IE-0009', title: 'Arıza', version: 2, priority: 'HIGH', status: 'ASSIGNED', dueAt: '2026-11-24T09:00:00.000Z' },
      team: { id: 3, name: 'Saha' },
      members: [{ id: 11, firstname: 'Ada', lastname: 'Yılmaz' }],
      ...overrides,
    });

    it('bildirim yazıldıktan sonra ack\'ler ve correlation id\'yi loglar', async () => {
      const { channel, message, context } = rmqContext();
      const event = overdue();

      await controller.onWorkOrderOverdue(event, context);

      expect(service.createForWorkOrderOverdue).toHaveBeenCalledWith(event);
      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('correlationId=overdue-check-abc'));
    });

    it('ekipsiz (team: null) olay geçerlidir', async () => {
      const { channel, context } = rmqContext();

      await controller.onWorkOrderOverdue(overdue({ team: null, members: [] }), context);

      expect(channel.ack).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['dueAt geçersiz', { workOrder: { id: 9, dueAt: 'dün' } }],
      ['team nesne değil', { team: 'Saha' }],
      ['members yok', { members: undefined }],
    ])('geçersiz olay (%s) atılır', async (_, overrides) => {
      const { channel, message, context } = rmqContext();

      await controller.onWorkOrderOverdue(overdue(overrides), context);

      expect(service.createForWorkOrderOverdue).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    });
  });

  it('workOrderStatusChanged bildirim üretmeden ack\'lenir', async () => {
    const { channel, context } = rmqContext();

    await controller.onWorkOrderStatusChanged(
      {
        eventId: randomUUID(),
        eventType: WORK_ORDER_STATUS_CHANGED,
        eventVersion: 1,
        occurredAt: '2026-11-23T10:00:00.000Z',
        correlationId: 'abc-123',
        workOrder: { id: 7, code: 'IE-0007', title: 'Arıza', version: 2 },
        fromStatus: 'ASSIGNED',
        toStatus: 'IN_PROGRESS',
        teamId: 3,
        reason: null,
        changedById: 1,
      },
      context,
    );

    expect(service.createForWorkOrderAssigned).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('loga yazılan correlation id doğrulanır (satır sonu enjeksiyonu yok)', async () => {
    const { context } = rmqContext();

    await controller.onWorkOrderAssigned({ ...assigned(), correlationId: 'x\nsahte satır' }, context);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('correlationId=-'));
  });
});

describe('handleWithManualAck', () => {
  it('requeue gecikmesi parametreyle değiştirilebilir', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { channel, message, context } = rmqContext();

    await handleWithManualAck(context, new Logger('test'), 'label', () => Promise.reject(new Error('x')), 0);

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    jest.restoreAllMocks();
  });
});
