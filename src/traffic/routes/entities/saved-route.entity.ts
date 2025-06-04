import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Route } from './route.entity';

@Entity('saved_routes')
export class SavedRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'json' })
  payload: any;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Route, (route) => route.savedRoute, { cascade: true })
  routes: Route[];
}
