import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import { safeCorrelationId } from '../common/correlation/correlation-id';
import {WORK_ORDER_ASSIGNED,WORK_ORDER_OVERDUE,WORK_ORDER_STATUS_CHANGED,parseWorkOrderAssignedEvent,parseWorkOrderOverdueEvent, parseWorkOrderStatusChangedEvent,} from '../common/events/work-order-events';
import { handleWithManualAck } from './manual-ack';
import { NotificationsService } from './notifications.service';

// Olay doğrulanmadan önce de loglanabilsin diye ham gövdeden okunur
function describe(pattern: string, data: unknown): string {
  const raw = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const eventId = typeof raw.eventId === 'string' ? safeCorrelationId(raw.eventId) : '-';
  return `${pattern} eventId=${eventId} correlationId=${safeCorrelationId(raw.correlationId)}`;
}

// Transport.RMQ: bu handler'lar yalnızca kuyruktan gelen olayları dinler, TCP'den çağrılamaz
@Controller()
export class NotificationEventsController {
  private readonly logger = new Logger(NotificationEventsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern<string>(WORK_ORDER_ASSIGNED, Transport.RMQ)
  onWorkOrderAssigned(@Payload() data: unknown, @Ctx() context: RmqContext) {
    const label = describe(WORK_ORDER_ASSIGNED, data);

    return handleWithManualAck(context, this.logger, label, async () => {
      const event = parseWorkOrderAssignedEvent(data);
      const { created, duplicate } = await this.notificationsService.createForWorkOrderAssigned(event);

      this.logger.log(
        `${label} workOrderId=${event.workOrder.id} teamId=${event.team.id} ` +
          `members=${event.members.length} created=${created} duplicate=${duplicate}`,
      );
    });
  }

  @EventPattern<string>(WORK_ORDER_OVERDUE, Transport.RMQ)
  onWorkOrderOverdue(@Payload() data: unknown, @Ctx() context: RmqContext) {
    const label = describe(WORK_ORDER_OVERDUE, data);

    return handleWithManualAck(context, this.logger, label, async () => {
      const event = parseWorkOrderOverdueEvent(data);
      const { created, duplicate } = await this.notificationsService.createForWorkOrderOverdue(event);

      this.logger.log(
        `${label} workOrderId=${event.workOrder.id} teamId=${event.team?.id ?? '-'} ` +
          `members=${event.members.length} created=${created} duplicate=${duplicate}`,
      );
    });
  }

  // Şimdilik bildirim üretmiyor; kuyrukta birikmesin ve "handler yok" diye atılmasın diye ack'lenir
  @EventPattern<string>(WORK_ORDER_STATUS_CHANGED, Transport.RMQ)
  onWorkOrderStatusChanged(@Payload() data: unknown, @Ctx() context: RmqContext) {
    const label = describe(WORK_ORDER_STATUS_CHANGED, data);

    return handleWithManualAck(context, this.logger, label, async () => {
      const event = parseWorkOrderStatusChangedEvent(data);
      this.logger.log(
        `${label} workOrderId=${event.workOrder.id} ${event.fromStatus}->${event.toStatus}`,
      );
    });
  }
}
