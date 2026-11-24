import { Controller, HttpStatus, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RpcException, TcpContext, Transport } from '@nestjs/microservices';
import { safeCorrelationId } from '../common/correlation/correlation-id';
import { NotificationsService } from './notifications.service';

// Transport.TCP: api'nin okuma istekleri; RabbitMQ kuyruğundan çağrılamaz
@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @MessagePattern('findNotifications', Transport.TCP)
  async findNotifications(
    @Payload() payload: { workforceUserId?: unknown },
    @Ctx() context: TcpContext,
  ) {
    const workforceUserId = payload?.workforceUserId;

    if (!Number.isInteger(workforceUserId) || (workforceUserId as number) <= 0) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Geçerli bir workforceUserId gönderilmelidir',
      });
    }

    const notifications = await this.notificationsService.findByWorkforceUser(
      workforceUserId as number,
    );

    this.logger.log(
      `findNotifications correlationId=${safeCorrelationId(context.getMetadata?.()?.correlationId)} ` +
        `workforceUserId=${String(workforceUserId)} count=${notifications.length}`,
    );

    return notifications;
  }
}
