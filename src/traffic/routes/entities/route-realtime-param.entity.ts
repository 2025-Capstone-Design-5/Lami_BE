import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Route } from './route.entity';

@Entity('route_realtime_params')
export class RouteRealtimeParam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Route, route => route.realtimeParams, { onDelete: 'CASCADE' })
  route: Route;

  @Column()
  stopId: string;

  @Column('bigint', { nullable: true })
  lastDepartureTime?: number;

  @Column('bigint', { nullable: true })
  lastArrivalTime?: number;

  @CreateDateColumn()
  createdAt: Date;
} 