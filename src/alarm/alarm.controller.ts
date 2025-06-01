import { Controller, Post, Body } from '@nestjs/common';
import { AlarmService } from './alarm.service';

@Controller('alarm')
export class AlarmController {
  constructor(private readonly alarmService: AlarmService) {}

  @Post('register')
  async register(
    @Body('wakeUpTime') wakeUpTime: string,
  ): Promise<{ message: string }> {
    await this.alarmService.registerAlarm(wakeUpTime);
    return { message: `알람이 ${wakeUpTime}에 설정되었습니다.` };
  }
}
