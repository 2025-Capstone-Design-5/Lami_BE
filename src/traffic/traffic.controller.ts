import { Controller, Post, Body } from '@nestjs/common';
import { TrafficService } from './traffic.service';
import { PlanDto } from '@/traffic/core/plan/dto/plan.dto';
import { OtpPlanResponse } from '@/traffic/core/otp/interfaces/otp.interfaces';

@Controller('traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Post('plan')
  async plan(@Body() dto: PlanDto): Promise<OtpPlanResponse> {
    return this.trafficService.planRoute(dto);
  }
}
