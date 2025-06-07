import {
  Entity,
  Column,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { BaseTimestampEntity } from '@/common/entities/base-timestamp.entity';
import { User } from '@/users/user.entity';
import { Category } from '@/favorites/entities/category.entity';

@Entity('favorite_routes')
export class FavoriteRoute extends BaseTimestampEntity {
  @Column()
  name: string;

  @Column()
  origin: string;

  @Column()
  destination: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToMany(() => Category, (category) => category.favoriteRoutes, {
    eager: true,
  })
  @JoinTable({
    name: 'favorite_route_categories',
    joinColumn: { name: 'favoriteRouteId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];
}
