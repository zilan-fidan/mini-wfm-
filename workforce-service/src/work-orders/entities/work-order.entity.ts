import {Entity,PrimaryGeneratedColumn,Column, ManyToOne,JoinColumn, CreateDateColumn,UpdateDateColumn,Index, VersionColumn,} from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Account } from '../../account/entities/account.entity';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';

@Entity({ schema: 'workforce', name: 'work_order' })
export class WorkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_work_order_code', { unique: true })
  @Column({ 
  type: 'varchar',
  length: 20,
  default: () => 'workforce.generate_work_order_code()',
  })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: WorkOrderPriority,
    enumName: 'work_order_priority_enum',
    default: WorkOrderPriority.MEDIUM,
  })
  priority: WorkOrderPriority;

  @Column({
    type: 'enum',
    enum: WorkOrderStatus,
    enumName: 'work_order_status_enum',
    default: WorkOrderStatus.OPEN,
  })
  status: WorkOrderStatus;

  @Column({
    name: 'team_id',
    type: 'int',
    nullable: true,
  })
  teamId: number | null;

  @ManyToOne(() => Team, {
   nullable: true,
   onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'team_id' })
   team: Team | null;

  @Column({
    name: 'due_at',
    type: 'timestamptz',
  })
  dueAt: Date;

    // Optimistic locking: her güncellemede TypeORM otomatik olarak 1 artırır
  @VersionColumn({
    type: 'int',
    default: 1,
  })
  version: number;


  @Column({
    name: 'created_by_id',
    type: 'int',
  })
  createdById: number;

  @ManyToOne(() => Account, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Account;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
