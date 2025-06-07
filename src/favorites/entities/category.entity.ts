import { Entity, Column, ManyToOne, ManyToMany, JoinColumn } from 'typeorm';
import { BaseTimestampEntity } from '@/common/entities/base-timestamp.entity';
import { User } from '@/users/user.entity';
import { FavoriteRoute } from '@/favorites/entities/favorite.entity';

@Entity('favorite_categories')
export class Category extends BaseTimestampEntity {
  @Column()
  name: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToMany(() => FavoriteRoute, (favorite) => favorite.categories)
  favoriteRoutes: FavoriteRoute[];
}
