import { Module, forwardRef } from '@nestjs/common';
import { OtpModule } from '@/traffic/core/otp/otp.module';
import { MappingModule } from '@/traffic/core/mapping/mapping.module';
import { RealtimeModule } from '@/traffic/core/realtime/realtime.module';
import { TmapModule } from '@/traffic/core/tmap/tmap.module';
import { PlanService } from '@/traffic/core/plan/plan.service';

@Module({
  imports: [OtpModule, MappingModule, forwardRef(() => RealtimeModule), TmapModule],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
