import {Entity,PrimaryGeneratedColumn,Column,ManyToOne,JoinColumn,} from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { Account } from '../../account/entities/account.entity';
import { WorkOrderStatus } from '../enums/work-order-status.enum';

@Entity({
  schema: 'workforce',
  name: 'work_order_status_history',
})
export class WorkOrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'work_order_id', type: 'integer' })
  workOrderId: number;

  @ManyToOne(() => WorkOrder, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: WorkOrder;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: WorkOrderStatus,
    enumName: 'work_order_status_enum',
    nullable: true,
  })
  fromStatus: WorkOrderStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: WorkOrderStatus,
    enumName: 'work_order_status_enum',
  })
  toStatus: WorkOrderStatus;

  @Column({
    name: 'team_id',
    type: 'integer',
    nullable: true,
  })
  teamId: number | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  reason: string | null;

  @Column({
    name: 'changed_by_id',
    type: 'integer',
  })
  changedById: number;

  @ManyToOne(() => Account, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'changed_by_id' })
  changedBy: Account;

  @Column({
    name: 'changed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  changedAt: Date;
}
