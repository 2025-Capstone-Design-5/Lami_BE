import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseCreateEntity } from '@/common/entities/base-create.entity';
import { Route } from '@/traffic/routes/entities/route.entity';

@Entity('route_realtime_params')
export class RouteRealtimeParam extends BaseCreateEntity {
  @ManyToOne(() => Route, (route) => route.realtimeParams, {
    onDelete: 'CASCADE',
  })
  route: Route;

  @Column()
  stopId: string;

  @Column('bigint', { nullable: true })
  lastDepartureTime?: number;

  @Column('bigint', { nullable: true })
  lastArrivalTime?: number;
}
