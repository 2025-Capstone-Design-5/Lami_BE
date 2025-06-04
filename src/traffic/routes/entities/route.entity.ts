import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { SavedRoute } from './saved-route.entity';
import { RouteRealtimeParam } from './route-realtime-param.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
