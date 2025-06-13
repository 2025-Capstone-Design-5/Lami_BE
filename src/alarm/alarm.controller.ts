import {
  Controller,
  Post,
  Body,
  NotFoundException,
  Get,
  Query,
  Delete,
  Param,
} from '@nestjs/common';
import { UsersService } from '@/users/users.service';
import { AlarmService } from './alarm.service';
import { Alarm } from './entities/alarm.entity';

@Controller('alarm')
export class AlarmController {
  constructor(
    private readonly alarmService: AlarmService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(
    @Body('googleId') googleId: string,
    @Body('arrivalTime') arrivalTimeISO: string,
    @Body('preparationTime') preparationTime: number,
  ): Promise<{ message: string; id: string }> {
    // 사용자 조회
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User ${googleId} not found`);
    }
    // 알람 저장
    const alarm = await this.alarmService.registerAlarm(
      user.id,
      arrivalTimeISO,
      preparationTime,
    );
    return {
      message: `알람이 ${alarm.wakeUpTime.toISOString()}에 설정되었습니다.`,
      id: alarm.id,
    };
  }

  @Get()
  async getAlarms(@Query('googleId') googleId: string): Promise<Alarm[]> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User ${googleId} not found`);
    }
    return this.alarmService.getAlarms(user.id);
  }

  @Delete(':id')
  async deleteAlarm(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.alarmService.deleteAlarm(id);
    if (!deleted) {
      throw new NotFoundException(`Alarm with id ${id} not found`);
    }
    return { deleted };
  }
}
