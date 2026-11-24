import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CorrelationContextService } from '../../common/correlation/correlation-context.service';
import { WorkOrderEventsPublisher } from '../../events/work-order-events.publisher';
import { WORK_ORDER_OVERDUE } from '../../events/work-order-events';
import { OVERDUE_CHECK_JOB, OverdueCheckJob } from './overdue-check.job';
import { OverdueClaim, OverdueWorkOrdersService } from './overdue-work-orders.service';

const claim = (id: number): OverdueClaim => ({
  workOrderId: id,
  claimedAt: new Date('2026-11-24T10:00:00Z'),
  eventId: `00000000-0000-5000-8000-00000000000${id}`,
  draft: {
    eventType: WORK_ORDER_OVERDUE,
    occurredAt: '2026-11-24T10:00:00.000Z',
    workOrder: { id, code: `IE-${id}`, title: 'x', version: 1, priority: 'HIGH', status: 'ASSIGNED', dueAt: '2026-11-24T09:00:00.000Z' },
    team: null,
    members: [],
  },
});

describe('OverdueCheckJob', () => {
  let overdue: { claimOverdue: jest.Mock; releaseClaim: jest.Mock };
  let events: { publishAndConfirm: jest.Mock };
  let correlation: CorrelationContextService;
  let registry: SchedulerRegistry;
  let job: OverdueCheckJob;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    overdue = { claimOverdue: jest.fn().mockResolvedValue([]), releaseClaim: jest.fn().mockResolvedValue(undefined) };
    events = { publishAndConfirm: jest.fn().mockResolvedValue(true) };
    correlation = new CorrelationContextService();
    registry = new SchedulerRegistry();
    const config = { get: jest.fn().mockReturnValue('* * * * *') } as unknown as ConfigService;
    job = new OverdueCheckJob(
      overdue as unknown as OverdueWorkOrdersService,
      events as unknown as WorkOrderEventsPublisher,
      correlation,
      registry,
      config as never,
    );
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    job.onApplicationShutdown();
    jest.restoreAllMocks();
  });

  it('ayardaki cron ifadesiyle kaydolur ve çalışır durumdadır', () => {
    job.onApplicationBootstrap();

    const cron = registry.getCronJob(OVERDUE_CHECK_JOB);
    expect(cron.cronTime.source).toBe('* * * * *');
    expect(cron.isActive).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"* * * * *"'));
  });

  it('hiç geciken iş emri yoksa da kaç tane bulduğunu loglar', async () => {
    await expect(job.run()).resolves.toEqual({ found: 0, published: 0, failed: 0, skipped: false });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('0 iş emri bulundu, 0 olay yayınlandı'));
  });

  it('her sahiplenilen iş emri için türetilmiş eventId ile bir olay yayınlar', async () => {
    overdue.claimOverdue.mockResolvedValue([claim(1), claim(2)]);

    await expect(job.run()).resolves.toMatchObject({ found: 2, published: 2, failed: 0 });

    expect(events.publishAndConfirm).toHaveBeenCalledTimes(2);
    expect(events.publishAndConfirm).toHaveBeenNthCalledWith(1, claim(1).draft, claim(1).eventId);
    expect(overdue.releaseClaim).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 iş emri bulundu, 2 olay yayınlandı'));
  });

  it('yayın başarısız olursa yalnızca o kaydın sahiplenmesi geri alınır ve uyarı loglanır', async () => {
    overdue.claimOverdue.mockResolvedValue([claim(1), claim(2)]);
    events.publishAndConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(job.run()).resolves.toMatchObject({ found: 2, published: 1, failed: 1 });

    expect(overdue.releaseClaim).toHaveBeenCalledTimes(1);
    expect(overdue.releaseClaim).toHaveBeenCalledWith(2, claim(2).claimedAt);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1 yayınlanamadı'));
  });

  it('olaylar çalışmaya ait correlation id ile yayınlanır', async () => {
    overdue.claimOverdue.mockResolvedValue([claim(1)]);
    let seen: string | undefined;
    events.publishAndConfirm.mockImplementation(async () => {
      seen = correlation.getCorrelationId();
      return true;
    });

    await job.run();

    expect(seen).toMatch(/^overdue-check-[0-9a-f-]{36}$/);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`correlationId=${seen}`));
  });

  it('önceki çalışma sürerken yeni tetikleme atlanır', async () => {
    let finish!: (value: OverdueClaim[]) => void;
    overdue.claimOverdue.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));

    const first = job.run();
    await expect(job.run()).resolves.toMatchObject({ skipped: true });
    expect(overdue.claimOverdue).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('atlandı'));

    finish([]);
    await first;
    await expect(job.run()).resolves.toMatchObject({ skipped: false });
  });

  it('veritabanı hatasında hata fırlatmaz, loglar ve sonraki çalışmaya izin verir', async () => {
    overdue.claimOverdue.mockRejectedValueOnce(new Error('db down'));

    await expect(job.run()).resolves.toMatchObject({ found: 0 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('başarısız'), expect.stringContaining('db down'));

    await expect(job.run()).resolves.toMatchObject({ skipped: false });
  });
});
