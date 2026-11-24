import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WorkOrderAssignedEvent } from '../common/events/work-order-events';
import { Notification, NotificationType } from './entities/notification.entity';

export const NOTIFICATION_LIST_LIMIT = 100;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Ekibin her aktif üyesine bir bildirim yazar.
   * Idempotent (P8): (event_id, workforce_user_id) tekil kısıt + ON CONFLICT DO NOTHING.
   * Aynı olay ikinci kez gelirse — RabbitMQ'nun "en az bir kez" teslimatı, ack'ten önce
   * çökme, iki tüketicinin aynı anda işlemesi — hiçbir satır eklenmez. Kontrolü veritabanı
   * yaptığı için "önce SELECT, sonra INSERT" yarışı da oluşmaz. Tek INSERT olduğu için
   * kayıtların hepsi yazılır ya da hiçbiri yazılmaz.
   */
  async createForWorkOrderAssigned(
    event: WorkOrderAssignedEvent,
  ): Promise<{ created: number; duplicate: number }> {
    const { workOrder, team } = event;

    const rows = event.members.map((member) => ({
      eventId: event.eventId,
      type: NotificationType.WORK_ORDER_ASSIGNED,
      workforceUserId: member.id,
      title: `Ekibinize iş emri atandı: ${workOrder.code}`.slice(0, 200),
      body: `"${workOrder.title}" iş emri ${team.name} ekibine atandı.`,
    }));

    if (rows.length === 0) {
      return { created: 0, duplicate: 0 };
    }

    const result = await this.notificationRepository
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values(rows)
      .orIgnore()
      .returning(['id'])
      .execute();

    // RETURNING yalnızca gerçekten eklenen satırları döndürür
    const created = Array.isArray(result.raw) ? result.raw.length : 0;
    return { created, duplicate: rows.length - created };
  }

  findByWorkforceUser(workforceUserId: number): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { workforceUserId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: NOTIFICATION_LIST_LIMIT,
    });
  }
}
