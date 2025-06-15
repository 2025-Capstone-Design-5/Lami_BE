import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alarm } from './entities/alarm.entity';
import { UsersService } from '@/users/users.service';
import { SavedRoute } from '@/traffic/routes/entities/saved-route.entity';

@Injectable()
export class AlarmService {
  private readonly logger = new Logger(AlarmService.name);
  constructor(
    @InjectRepository(Alarm)
    private readonly alarmRepo: Repository<Alarm>,
    @InjectRepository(SavedRoute)
    private readonly savedRouteRepo: Repository<SavedRoute>,
    private readonly usersService: UsersService,
  ) {}

  async registerAlarm(
    userId: string,
    arrivalTimeISO: string,
    preparationTime: number,
    savedRouteId?: string,
  ): Promise<Alarm> {
    const arrivalDate = new Date(arrivalTimeISO);
    let wakeUpDate: Date;
    if (savedRouteId) {
      const savedRoute = await this.savedRouteRepo.findOne({
        where: { id: savedRouteId },
      });
      if (savedRoute?.route?.summary?.duration) {
        const travelMs = savedRoute.route.summary.duration * 1000;
        wakeUpDate = new Date(
          arrivalDate.getTime() - travelMs - preparationTime * 60 * 1000,
        );
      } else {
        wakeUpDate = new Date(
          arrivalDate.getTime() - preparationTime * 60 * 1000,
        );
      }
    } else {
      wakeUpDate = new Date(
        arrivalDate.getTime() - preparationTime * 60 * 1000,
      );
    }
    this.logger.log(
      `알람 생성: userId=${userId}, wakeUpTime=${wakeUpDate.toISOString()}`,
    );
    const alarm = this.alarmRepo.create({
      userId,
      arrivalTime: arrivalDate,
      preparationTime,
      wakeUpTime: wakeUpDate,
      ...(savedRouteId ? { savedRouteId } : {}),
    });
    const saved = await this.alarmRepo.save(alarm);
    return saved;
  }

  // Get all alarms for a user
  async getAlarms(userId: string): Promise<Alarm[]> {
    return this.alarmRepo.find({ where: { userId } });
  }

  // Delete an alarm by ID
  async deleteAlarm(id: string): Promise<boolean> {
    const result = await this.alarmRepo.delete(id);
    // DeleteResult.affected can be null, treat null as 0
    return (result.affected ?? 0) > 0;
  }

  /**
   * Remove all existing route-based alarms (linked to savedRoute) for a user.
   */
  async clearRouteAlarms(userId: string): Promise<void> {
    await this.alarmRepo
      .createQueryBuilder()
      .delete()
      .from(Alarm)
      .where('userId = :userId AND savedRouteId IS NOT NULL', { userId })
      .execute();
    this.logger.log(`Cleared existing route-based alarms for user ${userId}`);
  }
}
