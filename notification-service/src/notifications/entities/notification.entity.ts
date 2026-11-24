import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum NotificationType {
  WORK_ORDER_ASSIGNED = 'WORK_ORDER_ASSIGNED',
}

// Bir olay birden çok personele bildirim üretir (ekibin her aktif üyesi).
// eventId bu yüzden personel başına tekildir: aynı olay aynı personele ikinci kez yazılamaz (P8).
@Entity({ schema: 'notification', name: 'notification' })
@Unique('UQ_notification_event_user', ['eventId', 'workforceUserId'])
@Index('IDX_notification_user_created', ['workforceUserId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  // workforce şemasındaki personel; servisler arası FK yok, her servis kendi verisinin sahibi
  @Column({ type: 'int' })
  workforceUserId: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
