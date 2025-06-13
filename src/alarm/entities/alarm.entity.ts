import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseCreateEntity } from '@/common/entities/base-create.entity';
import { User } from '@/users/user.entity';

@Entity('alarms')
export class Alarm extends BaseCreateEntity {
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamp' })
  arrivalTime: Date;

  @Column({ type: 'int', default: 0 })
  preparationTime: number;

  @Column({ type: 'timestamp' })
  wakeUpTime: Date;

  @Column({ type: 'uuid', nullable: true })
  savedRouteId?: string;
}
