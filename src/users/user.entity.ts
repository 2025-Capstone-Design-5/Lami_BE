import { Entity, Column } from 'typeorm';
import { BaseTimestampEntity } from '@/common/entities/base-timestamp.entity';

export enum UserRole {
  ROOT = 'root',
  GOOGLE = 'google',
}

@Entity('users')
export class User extends BaseTimestampEntity {
  @Column({ unique: true, nullable: true })
  googleId?: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.GOOGLE })
  role: UserRole;

  @Column({ nullable: true })
  accessToken?: string;

  @Column({ nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenIssuedAt?: Date;
}
