import { Module } from '@nestjs/common';
import { AlarmController } from './alarm.controller';
import { AlarmService } from './alarm.service';

@Module({
  controllers: [AlarmController],
  providers: [AlarmService],
  exports: [AlarmService],  // 다른 모듈(ChatService 등)에서 사용 가능하게 함
})
export class AlarmModule {}
