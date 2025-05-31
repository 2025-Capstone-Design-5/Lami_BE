import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { AlarmService } from '../alarm/alarm.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly llmService: LlmService,
    private readonly alarmService: AlarmService,
  ) {}

  async processMessage(message: string) {
    const alarmInfo = await this.llmService.extractAlarmDetails(message);

    // 알람 등록 로직이 필요할 경우 실행
    if (alarmInfo.wake_up_time) {
      await this.alarmService.registerAlarm(alarmInfo.wake_up_time);
    }

    return {
      response: `출발지는 ${alarmInfo.departure}, 도착지는 ${alarmInfo.destination}, 도착시간은 ${alarmInfo.arrival_time}, 알람은 ${alarmInfo.wake_up_time}에 울릴 예정입니다.`,
      data: alarmInfo,
    };
  }
}
