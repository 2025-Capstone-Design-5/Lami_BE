import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { FavoriteRoute } from './entities/favorite.entity';
import { UsersModule } from '../users/users.module';
import { CategoriesModule } from './categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FavoriteRoute]),
    UsersModule,
    CategoriesModule,
  ],
  providers: [FavoritesService],
  controllers: [FavoritesController],
})
export class FavoritesModule {}
