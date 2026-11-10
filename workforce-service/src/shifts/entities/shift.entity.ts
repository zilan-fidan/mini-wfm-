import {Entity,PrimaryGeneratedColumn,Column,CreateDateColumn,UpdateDateColumn,Index,ManyToOne,JoinColumn,} from 'typeorm';
import { WorkforceUser } from '../../workforce-users/entities/workforce-user.entity';
import { Account } from '../../account/entities/account.entity';

@Entity({ schema: 'workforce', name: 'shift' })
@Index('IDX_shift_start_at', ['startAt'])
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'workforce_user_id', type: 'int' })
  workforceUserId: number;

  @ManyToOne(() => WorkforceUser, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workforce_user_id' })
  workforceUser: WorkforceUser;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'created_by_id', type: 'int' })
  createdById: number;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Account;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
