import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class VoiceService {
  constructor(private readonly llmService: LlmService) {}

  async handleVoiceCommand(command: string): Promise<{ alarmTime: string }> {
    const alarmTime = await this.llmService.extractAlarmTime(command);
    // 여기서 추가적으로 알람 등록 로직을 넣을 수 있습니다
    return { alarmTime };
  }
}
