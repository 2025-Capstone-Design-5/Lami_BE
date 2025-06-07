import { Entity, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { BaseCreateEntity } from '@/common/entities/base-create.entity';
import { User } from '@/users/user.entity';
import { Route } from './route.entity';

@Entity('saved_routes')
export class SavedRoute extends BaseCreateEntity {
  // 누가 저장했는지
  @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // 검색 바 파라미터
  @Column() origin: string;
  @Column() destination: string;
  // User-specified arrival time (combined date and time)
  @Column({ type: 'timestamp' })
  arrivalTime: Date;

  // Preparation time in minutes before departure
  @Column({ type: 'int', default: 0 })
  preparationTime: number;

  // OTP 옵션 전체를 그대로 저장 (agent가 그대로 재사용 가능)
  @Column({ type: 'json', nullable: true })
  options?: Record<string, any>;

  // general / home / work 같은 카테고리
  @Column({ default: 'general' }) category: string;

  // 선택된 라우트 1건
  @OneToOne(() => Route, (r) => r.savedRoute, { cascade: true })
  @JoinColumn()
  route: Route;
}
