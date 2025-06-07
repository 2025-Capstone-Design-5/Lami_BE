import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /**
   * GET /favorites?googleId=...
   */
  @Get()
  async getFavorites(@Query('googleId') googleId: string) {
    const favorites = await this.favoritesService.getFavorites(googleId);
    return { data: favorites };
  }

  /**
   * POST /favorites
   * body: { googleId, name, origin, destination }
   */
  @Post()
  async addFavorite(@Body() body: CreateFavoriteDto & { googleId: string }) {
    const { googleId, ...createDto } = body;
    const favorite = await this.favoritesService.addFavorite(
      googleId,
      createDto,
    );
    return { data: favorite };
  }

  /**
   * DELETE /favorites/:id?googleId=...
   */
  @Delete(':id')
  async removeFavorite(
    @Param('id') id: string,
    @Query('googleId') googleId: string,
  ) {
    await this.favoritesService.removeFavorite(googleId, id);
    return { message: 'Favorite deleted successfully' };
  }
}
