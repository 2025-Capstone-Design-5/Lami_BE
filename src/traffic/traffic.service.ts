import { Injectable } from '@nestjs/common';
import { PlanService } from '@/traffic/core/plan/plan.service';
import { OtpPlanResponse } from '@/traffic/core/otp/interfaces/otp.interfaces';

@Injectable()
export class TrafficService {
  constructor(private readonly planService: PlanService) {}

  async planRoute(dto: {
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
  }): Promise<OtpPlanResponse> {
    return this.planService.planRoute(
      { lat: dto.fromLat, lon: dto.fromLon },
      { lat: dto.toLat, lon: dto.toLon },
    );
  }
}
