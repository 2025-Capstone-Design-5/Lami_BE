import { Entity, Column, OneToOne } from 'typeorm';
import { BaseIdEntity } from '@/common/entities/base-id.entity';
import { SavedRoute } from './saved-route.entity';

@Entity('routes')
export class Route extends BaseIdEntity {
  @OneToOne(() => SavedRoute, (sr) => sr.route)
  savedRoute: SavedRoute;

  @Column({ type: 'json' })
  summary: any;

  @Column({ type: 'json' })
  detail: any;

  @Column({ nullable: true })
  cityCode?: string;

  @Column({ nullable: true })
  routeId?: string;

  @Column({ nullable: true })
  nodeId?: string;

  @Column('text', { array: true, default: [] })
  linkIds: string[];

  @Column('text', { array: true, default: [] })
  sectionIds: string[];
}
