import { Entity, Column, OneToMany } from 'typeorm';
import { BaseCreateEntity } from '@/common/entities/base-create.entity';
import { Route } from '@/traffic/routes/entities/route.entity';

@Entity('saved_routes')
export class SavedRoute extends BaseCreateEntity {
  @Column({ type: 'json' })
  payload: any;

  @OneToMany(() => Route, (route) => route.savedRoute, { cascade: true })
  routes: Route[];
}
