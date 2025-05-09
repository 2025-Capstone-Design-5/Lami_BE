import { Module } from '@nestjs/common';
import { TrafficController } from './traffic.controller';
import { TrafficService } from './traffic.service';
import { OtpModule } from '@/traffic/core/otp/otp.module';
import { TmapModule } from '@/traffic/core/tmap/tmap.module';
import { MappingModule } from '@/traffic/core/mapping/mapping.module';
import { PlanModule } from '@/traffic/core/plan/plan.module';
import { RealtimeModule } from '@/traffic/core/realtime/realtime.module';

@Module({
  imports: [OtpModule, TmapModule, MappingModule, PlanModule, RealtimeModule],
  controllers: [TrafficController],
  providers: [TrafficService],
})
export class TrafficModule {}
