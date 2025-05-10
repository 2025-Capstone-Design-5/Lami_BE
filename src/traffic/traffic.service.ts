import { Injectable } from '@nestjs/common';
import { PlanService } from '@/traffic/core/plan/plan.service';
import { OtpPlanResponse } from '@/traffic/core/otp/interfaces/otp.interfaces';
import { PlanDto } from '@/traffic/core/plan/dto/plan.dto';

@Injectable()
export class TrafficService {
  constructor(private readonly planService: PlanService) {}

  async planRoute(dto: PlanDto): Promise<OtpPlanResponse> {
    return this.planService.planRoute(dto.fromAddress, dto.toAddress);
  }
}
