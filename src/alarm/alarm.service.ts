import { Injectable } from '@nestjs/common';

@Injectable()
export class AlarmService {
  registerAlarm(wakeUpTime: string): void {
    console.log(`⏰ 알람이 ${wakeUpTime}에 설정됩니다.`);
    // DB 저장 or 알람 예약 로직
  }
}
