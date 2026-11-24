import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WorkOrderAssignedEvent, WorkOrderOverdueEvent } from '../common/events/work-order-events';
import { Notification, NotificationType } from './entities/notification.entity';

export const NOTIFICATION_LIST_LIMIT = 100;
// Bildirim metnindeki tarih kullanıcıların saatiyle yazılır (UTC değil)
export const NOTIFICATION_TIME_ZONE = 'Europe/Istanbul';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  // Ekibin her aktif üyesine atama bildirimi
  createForWorkOrderAssigned(event: WorkOrderAssignedEvent) {
    const { workOrder, team } = event;

    return this.createForMembers(event.eventId, event.members, {
      type: NotificationType.WORK_ORDER_ASSIGNED,
      title: `Ekibinize iş emri atandı: ${workOrder.code}`,
      body: `"${workOrder.title}" iş emri ${team.name} ekibine atandı.`,
    });
  }

  // İş emrinin ekibindeki aktif üyelere gecikme bildirimi; ekipsiz iş emrinde kimseye yazılmaz
  createForWorkOrderOverdue(event: WorkOrderOverdueEvent) {
    const { workOrder } = event;
    const dueAt = new Date(workOrder.dueAt).toLocaleString('tr-TR', {
      timeZone: NOTIFICATION_TIME_ZONE,
      dateStyle: 'short',
      timeStyle: 'short',
    });

    return this.createForMembers(event.eventId, event.members, {
      type: NotificationType.WORK_ORDER_OVERDUE,
      title: `İş emri gecikti: ${workOrder.code}`,
      body: `"${workOrder.title}" iş emrinin bitiş zamanı (${dueAt}) geçti.`,
    });
  }

  /**
   * Her üyeye bir bildirim yazar.
   *
   * Idempotent (P8): (event_id, workforce_user_id) tekil kısıt + ON CONFLICT DO NOTHING.
   * Aynı olay ikinci kez gelirse — RabbitMQ'nun "en az bir kez" teslimatı, ack'ten önce
   * çökme, iki tüketicinin aynı anda işlemesi, yayıncının aynı eventId ile tekrar denemesi —
   * hiçbir satır eklenmez. Kontrolü veritabanı yaptığı için "önce SELECT, sonra INSERT"
   * yarışı da oluşmaz. Tek INSERT olduğu için kayıtların hepsi yazılır ya da hiçbiri yazılmaz.
   */
  private async createForMembers(
    eventId: string,
    members: { id: number }[],
    content: { type: NotificationType; title: string; body: string },
  ): Promise<{ created: number; duplicate: number }> {
    const rows = members.map((member) => ({
      eventId,
      type: content.type,
      workforceUserId: member.id,
      title: content.title.slice(0, 200),
      body: content.body,
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
