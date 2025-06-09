import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Delete,
  Param,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteRoute } from './entities/favorite-route.entity';
import { CreateFavoriteRouteDto } from './dto/create-favorite-route.dto';
import { UsersService } from '@/users/users.service';
import { AlarmService } from '@/alarm/alarm.service';

@Controller('traffic/routes/favorites')
export class FavoriteRoutesController {
  private readonly logger = new Logger(FavoriteRoutesController.name);
  constructor(
    @InjectRepository(FavoriteRoute)
    private readonly favoritesRepo: Repository<FavoriteRoute>,
    private readonly usersService: UsersService,
    private readonly alarmService: AlarmService,
  ) {}

  @Post()
  async createFavorite(
    @Body() dto: CreateFavoriteRouteDto,
  ): Promise<FavoriteRoute> {
    this.logger.log(`[FavoriteRoutes] create dto: ${JSON.stringify(dto)}`);
    const user = await this.usersService.findByGoogleId(dto.googleId);
    if (!user) {
      throw new NotFoundException(`User ${dto.googleId} not found`);
    }
    const favorite = this.favoritesRepo.create({
      userId: user.id,
      origin: dto.origin,
      destination: dto.destination,
      category: dto.category,
    });
    const saved = await this.favoritesRepo.save(favorite);
    // Parse wakeUpTime (HH:mm) into an ISO datetime string
    let arrivalIso: string;
    try {
      const [hourStr, minuteStr] = dto.wakeUpTime.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      let arrivalDate = new Date();
      arrivalDate.setHours(hour, minute, 0, 0);
      // If the time has already passed today, schedule for tomorrow
      if (arrivalDate < new Date()) {
        arrivalDate.setDate(arrivalDate.getDate() + 1);
      }
      arrivalIso = arrivalDate.toISOString();
    } catch (err) {
      this.logger.error(
        `[FavoriteRoutes] Invalid wakeUpTime format: ${dto.wakeUpTime}`,
        err.stack,
      );
      // Fallback to now
      arrivalIso = new Date().toISOString();
    }
    await this.alarmService.registerAlarm(user.id, arrivalIso, 0);

    this.logger.log(`[FavoriteRoutes] created id=${saved.id}`);
    return saved;
  }

  @Get()
  async getFavorites(
    @Query('googleId') googleId: string,
  ): Promise<FavoriteRoute[]> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User ${googleId} not found`);
    }
    return this.favoritesRepo.find({ where: { userId: user.id } });
  }

  @Delete(':id')
  async deleteFavorite(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const result = await this.favoritesRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Favorite with id ${id} not found`);
    }
    this.logger.log(`[FavoriteRoutes] deleted id=${id}`);
    return { deleted: true };
  }
}
