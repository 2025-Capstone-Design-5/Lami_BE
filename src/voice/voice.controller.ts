import { Controller, Post, Body } from '@nestjs/common';
import { VoiceService } from './voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('command')
  async receiveVoiceCommand(@Body('text') text: string): Promise<{ alarmTime: string }> {
    return this.voiceService.handleVoiceCommand(text);
  }
}
