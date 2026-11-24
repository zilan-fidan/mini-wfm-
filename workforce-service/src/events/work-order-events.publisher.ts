import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { lastValueFrom, timeout } from 'rxjs';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';
import { EVENT_PUBLISH_TIMEOUT_MS, NOTIFICATION_EVENTS_CLIENT } from './events.constants';
import type { WorkOrderEvent, WorkOrderEventDraft } from './work-order-events';

// amqp-connection-manager bağlantı hatasını Error yerine { err, url } nesnesi olarak verebilir
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    // Node localhost'u hem ::1 hem 127.0.0.1 ile dener; ikisi de reddedilince mesajı boş AggregateError gelir
    const nested = (error as Error & { errors?: unknown[] }).errors;
    if (!error.message && Array.isArray(nested) && nested.length) return nested.map(describeError).join('; ');
    return error.message || (error as Error & { code?: string }).code || error.name;
  }
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const { err, message, code } = error as { err?: unknown; message?: unknown; code?: unknown };
    if (err !== undefined) return describeError(err);
    if (typeof message === 'string') return message;
    if (typeof code === 'string') return code;
    try {
      return JSON.stringify(error).slice(0, 300);
    } catch {
      return 'bilinmeyen hata';
    }
  }
  return String(error);
}

/**
 * İş emri olaylarını RabbitMQ'ya yayınlar.
 * B22: Yalnızca transaction commit edildikten sonra çağrılır. Geri alınan işlem için olay çıkmaz.
 * B23: RabbitMQ'ya ulaşılamaması iş emri işlemini bozmaz. `publish` hiçbir zaman hata fırlatmaz
 *      ve beklenmez; yayın arka planda denenir, başarısızlık loglanır. Bedeli: o sırada
 *      yayınlanamayan olay kaybolur (outbox yok), ilgili bildirimler oluşmaz.
 */
@Injectable()
export class WorkOrderEventsPublisher {
  private readonly logger = new Logger(WorkOrderEventsPublisher.name);

  constructor(
    @Inject(NOTIFICATION_EVENTS_CLIENT) private readonly client: ClientProxy,
    private readonly correlationContext: CorrelationContextService,
    @Inject(EVENT_PUBLISH_TIMEOUT_MS) private readonly publishTimeoutMs: number,
  ) {}

  // Fire-and-forget: çağıran beklemez, yanıt RabbitMQ'yu beklemeden döner
  publish(drafts: WorkOrderEventDraft[]): void {
    const correlationId = this.correlationContext.getCorrelationId() ?? null;

    for (const draft of drafts) {
      const event = {
        ...draft,
        eventId: randomUUID(),
        eventVersion: 1,
        correlationId,
      } as WorkOrderEvent;

      void this.publishOne(event);
    }
  }

  // Hata fırlatmaz; sonuç loglanır ve test için boolean döner
  async publishOne(event: WorkOrderEvent): Promise<boolean> {
    const label =
      `${event.eventType} eventId=${event.eventId} ` +
      `correlationId=${event.correlationId ?? '-'} workOrderId=${event.workOrder.id}`;

    try {
      const record = new RmqRecordBuilder(event)
        .setOptions({
          messageId: event.eventId,
          // Kuyruk durable + mesaj persistent: broker yeniden başlasa da bekleyen olay kaybolmaz
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.parse(event.occurredAt),
          ...(event.correlationId ? { correlationId: event.correlationId } : {}),
        })
        .build();

      // Broker kapalıyken bağlantı denemesi ya da onay beklemesi uzarsa süre sınırı keser
      await lastValueFrom(
        this.client.emit(event.eventType, record).pipe(timeout(this.publishTimeoutMs)),
        { defaultValue: undefined },
      );

      this.logger.log(`${label} yayınlandı`);
      return true;
    } catch (error) {
      const reason = describeError(error);
      this.logger.error(`${label} yayınlanamadı, olay kayboldu (RabbitMQ'ya ulaşılamıyor): ${reason}`);
      return false;
    }
  }
}
