import { Module, forwardRef } from '@nestjs/common';
import { PlanModule } from '@/traffic/core/plan/plan.module';
import { RealtimeService } from '@/traffic/core/realtime/realtime.service';

@Module({
  imports: [forwardRef(() => PlanModule)],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
