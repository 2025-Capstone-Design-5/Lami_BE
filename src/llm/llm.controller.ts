import { Controller, Post, Body } from '@nestjs/common';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('extract-time')
  async extractTime(@Body('text') text: string): Promise<{ alarmTime: string }> {
    const alarmTime = await this.llmService.extractAlarmTime(text);
    return { alarmTime };
  }
}
