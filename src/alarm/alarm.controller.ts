import { Controller, Post, Body } from '@nestjs/common';
import { AlarmService } from './alarm.service';

@Controller('alarm')
export class AlarmController {
  constructor(private readonly alarmService: AlarmService) {}

  @Post('register')
  register(@Body('wakeUpTime') wakeUpTime: string): { message: string } {
    this.alarmService.registerAlarm(wakeUpTime);
    return { message: `알람이 ${wakeUpTime}에 설정되었습니다.` };
  }
}
