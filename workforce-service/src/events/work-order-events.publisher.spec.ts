import { Logger } from '@nestjs/common';
import { ClientProxy, RmqRecord } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';
import { WORK_ORDER_STATUS_CHANGED, WorkOrderEventDraft, WorkOrderEvent } from './work-order-events';
import { WorkOrderEventsPublisher } from './work-order-events.publisher';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const draft = (): WorkOrderEventDraft => ({
  eventType: WORK_ORDER_STATUS_CHANGED,
  occurredAt: '2026-11-23T10:00:00.000Z',
  workOrder: { id: 7, code: 'IE-0007', title: 'Arıza', version: 2 },
  fromStatus: 'OPEN',
  toStatus: 'CANCELLED',
  teamId: null,
  reason: 'İptal',
  changedById: 1,
});

describe('WorkOrderEventsPublisher', () => {
  let emit: jest.Mock;
  let correlation: CorrelationContextService;
  let publisher: WorkOrderEventsPublisher;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    emit = jest.fn(() => of(undefined));
    correlation = new CorrelationContextService();
    publisher = new WorkOrderEventsPublisher({ emit } as unknown as ClientProxy, correlation, 50);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('her olaya benzersiz eventId ve isteğin correlation id\'sini ekler', async () => {
    correlation.run({ correlationId: 'abc-123', startedAt: 0 }, () => publisher.publish([draft(), draft()]));
    await flush();

    expect(emit).toHaveBeenCalledTimes(2);
    const [[pattern, first], [, second]] = emit.mock.calls as [string, RmqRecord<WorkOrderEvent>][];
    expect(pattern).toBe(WORK_ORDER_STATUS_CHANGED);
    expect(first.data).toMatchObject({ eventVersion: 1, correlationId: 'abc-123', workOrder: { id: 7 } });
    expect(first.data.eventId).toMatch(UUID);
    expect(second.data.eventId).not.toBe(first.data.eventId);
    // AMQP özelliklerinde de taşınır: yönetim arayüzünde ve tüketicide görünür
    expect(first.options).toMatchObject({ messageId: first.data.eventId, correlationId: 'abc-123', persistent: true });
  });

  it('RabbitMQ hatası çağırana yansımaz, hata loglanır (B23)', async () => {
    emit.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED 127.0.0.1:5672')));

    expect(() => publisher.publish([draft()])).not.toThrow();
    await flush();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('yayınlanamadı'));
  });

  it('Error olmayan bağlantı hatası da okunur biçimde loglanır', async () => {
    emit.mockReturnValue(throwError(() => ({ err: Object.assign(new Error('connect ECONNREFUSED ::1:5672'), { code: 'ECONNREFUSED' }), url: 'amqp://x' })));

    publisher.publish([draft()]);
    await flush();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('connect ECONNREFUSED ::1:5672'));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('[object Object]'));
  });

  it('mesajı boş AggregateError içindeki hatalar loglanır', async () => {
    emit.mockReturnValue(throwError(() => new AggregateError([new Error('connect ECONNREFUSED ::1:5672'), new Error('connect ECONNREFUSED 127.0.0.1:5672')])));

    publisher.publish([draft()]);
    await flush();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED ::1:5672; connect ECONNREFUSED 127.0.0.1:5672'));
  });

  it('emit senkron hata fırlatsa da publish hata fırlatmaz', async () => {
    emit.mockImplementation(() => { throw new Error('boom'); });

    expect(() => publisher.publish([draft()])).not.toThrow();
    await flush();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('bağlantı asılı kalırsa süre sınırında vazgeçer ve loglar', async () => {
    emit.mockReturnValue(NEVER);
    const event = { ...draft(), eventId: '00000000-0000-4000-8000-000000000000', eventVersion: 1, correlationId: null } as WorkOrderEvent;

    await expect(publisher.publishOne(event)).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Timeout'));
  });

  it('publish çağıranı beklemez: emit tamamlanmadan döner', () => {
    emit.mockReturnValue(NEVER);
    const result = publisher.publish([draft()]);
    expect(result).toBeUndefined();
  });
});
