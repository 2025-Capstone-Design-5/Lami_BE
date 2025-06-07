import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseIdEntity } from '@/common/entities/base-id.entity';
import { SavedRoute } from '@/traffic/routes/entities/saved-route.entity';
import { RouteRealtimeParam } from '@/traffic/routes/entities/route-realtime-param.entity';

@Entity('routes')
export class Route extends BaseIdEntity {
  @ManyToOne(() => SavedRoute, (savedRoute) => savedRoute.routes, {
    onDelete: 'CASCADE',
  })
  savedRoute: SavedRoute;

  @Column()
  category: string;

  @Column('int')
  duration: number;

  @Column('text', { array: true, default: [] })
  modes: string[];

  @Column('text', { array: true, default: [] })
  routeShortNames: string[];

  @Column('text', { array: true, default: [] })
  stops: string[];

  @Column('text', { array: true, default: [] })
  stopIds: string[];

  @Column({ type: 'json', nullable: true })
  details: any;

  @OneToMany(() => RouteRealtimeParam, (p: RouteRealtimeParam) => p.route, {
    cascade: true,
  })
  realtimeParams: RouteRealtimeParam[];
}
