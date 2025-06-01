import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmModule } from '../llm/llm.module';
import { AlarmModule } from '../alarm/alarm.module';

@Module({
  imports: [LlmModule, AlarmModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
