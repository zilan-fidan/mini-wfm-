import {Column,CreateDateColumn, Entity,OneToMany,PrimaryGeneratedColumn,UpdateDateColumn,} from 'typeorm';
import { WorkforceUser } from '../../workforce-users/entities/workforce-user.entity';

@Entity({ schema: 'workforce', name: 'team' })
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Ekibin personelleri; sadece ekip detayında yüklenir
  @OneToMany(() => WorkforceUser, (workforceUser) => workforceUser.team)
  members: WorkforceUser[];
}
