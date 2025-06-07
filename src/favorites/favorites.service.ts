import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteRoute } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UsersService } from '../users/users.service';
import { CategoriesService } from './categories.service';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteRoute)
    private readonly favoritesRepo: Repository<FavoriteRoute>,
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async getFavorites(googleId: string): Promise<FavoriteRoute[]> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User with googleId ${googleId} not found`);
    }
    return this.favoritesRepo.find({ where: { userId: user.id } });
  }

  async addFavorite(
    googleId: string,
    createDto: CreateFavoriteDto,
  ): Promise<FavoriteRoute> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User with googleId ${googleId} not found`);
    }
    const favorite = this.favoritesRepo.create({
      userId: user.id,
      name: createDto.name,
      origin: createDto.origin,
      destination: createDto.destination,
    });
    if (createDto.categoryIds && createDto.categoryIds.length) {
      const categories = await this.categoriesService.findByIds(
        user.id,
        createDto.categoryIds,
      );
      favorite.categories = categories;
    }
    return this.favoritesRepo.save(favorite);
  }

  async removeFavorite(googleId: string, favoriteId: string): Promise<void> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User with googleId ${googleId} not found`);
    }
    await this.favoritesRepo.delete({ id: favoriteId, userId: user.id });
  }
}
