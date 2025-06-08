import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseCreateEntity } from '@/common/entities/base-create.entity';
import { User } from '@/users/user.entity';

@Entity('favorite_routes')
export class FavoriteRoute extends BaseCreateEntity {
  // 이 즐겨찾기가 속한 사용자
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // 출발지
  @Column()
  origin: string;

  // 목적지
  @Column()
  destination: string;

  // 사용자 지정 카테고리 (general, home, work, school 등)
  @Column({ default: 'general' })
  category: string;
}
