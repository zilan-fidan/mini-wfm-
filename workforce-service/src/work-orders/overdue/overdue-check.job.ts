import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { randomUUID } from 'node:crypto';
import { CorrelationContextService } from '../../common/correlation/correlation-context.service';
import { WorkforceEnv } from '../../config/env.validation';
import { WorkOrderEventsPublisher } from '../../events/work-order-events.publisher';
import { OverdueWorkOrdersService } from './overdue-work-orders.service';

export const OVERDUE_CHECK_JOB = 'overdueWorkOrderCheck';

export interface OverdueCheckResult {
  found: number;
  published: number;
  failed: number;
  skipped: boolean;
}

/**
 * Kimse istek atmadan, OVERDUE_CHECK_CRON aralığında çalışır.
 *
 * @Cron() dekoratörü yerine SchedulerRegistry: dekoratöre verilen ifade derleme anında sabittir,
 * aralığın ayardan (ConfigService) gelmesi için iş açılışta elle kaydedilir.
 */
@Injectable()
export class OverdueCheckJob implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OverdueCheckJob.name);
  private running = false;

  constructor(
    private readonly overdueWorkOrders: OverdueWorkOrdersService,
    private readonly events: WorkOrderEventsPublisher,
    private readonly correlationContext: CorrelationContextService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService<WorkforceEnv, true>,
  ) {}

  onApplicationBootstrap() {
    const expression = this.config.get('OVERDUE_CHECK_CRON', { infer: true });
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => void this.run(),
      start: false,
    });

    this.schedulerRegistry.addCronJob(OVERDUE_CHECK_JOB, job);
    job.start();
    this.logger.log(`Geciken iş emri kontrolü zamanlandı: "${expression}"`);
  }

  onApplicationShutdown() {
    if (this.schedulerRegistry.doesExist('cron', OVERDUE_CHECK_JOB)) {
      this.schedulerRegistry.deleteCronJob(OVERDUE_CHECK_JOB);
    }
  }

  // Hata fırlatmaz: zamanlayıcının bir sonraki tetiklemesi her durumda çalışmalı
  async run(now: Date = new Date()): Promise<OverdueCheckResult> {
    // Bir çalışma aralıktan uzun sürerse (yavaş DB, RabbitMQ zaman aşımları) yenisi üst üste binmesin
    if (this.running) {
      this.logger.warn('Geciken iş emri kontrolü atlandı: önceki çalışma hâlâ sürüyor');
      return { found: 0, published: 0, failed: 0, skipped: true };
    }
    this.running = true;

    // HTTP isteği olmadığı için correlation id burada üretilir; olaylar ve loglar bununla izlenir
    const correlationId = `overdue-check-${randomUUID()}`;
    const startedAt = performance.now();

    try {
      return await this.correlationContext.run({ correlationId, startedAt }, async () => {
        const claims = await this.overdueWorkOrders.claimOverdue(now);
        let published = 0;
        let failed = 0;

        // Sahiplenme commit edildi; olaylar transaction'dan SONRA yayınlanır (B22)
        for (const claim of claims) {
          if (await this.events.publishAndConfirm(claim.draft, claim.eventId)) {
            published += 1;
          } else {
            // RabbitMQ'ya ulaşılamadı: işaret geri alınır, sonraki çalışmada aynı eventId ile denenir
            failed += 1;
            await this.overdueWorkOrders.releaseClaim(claim.workOrderId, claim.claimedAt);
          }
        }

        const duration = Math.round(performance.now() - startedAt);
        const message =
          `Geciken iş emri kontrolü: ${claims.length} iş emri bulundu, ${published} olay yayınlandı` +
          `${failed ? `, ${failed} yayınlanamadı (sonraki çalışmada tekrar denenecek)` : ''} ` +
          `correlationId=${correlationId} duration=${duration}ms`;

        if (failed) {
          this.logger.warn(message);
        } else {
          this.logger.log(message);
        }

        return { found: claims.length, published, failed, skipped: false };
      });
    } catch (error) {
      this.logger.error(
        `Geciken iş emri kontrolü başarısız correlationId=${correlationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { found: 0, published: 0, failed: 0, skipped: false };
    } finally {
      this.running = false;
    }
  }
}
