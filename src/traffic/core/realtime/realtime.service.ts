import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PlanService } from '@/traffic/core/plan/plan.service';

@Injectable()
export class RealtimeService {
  constructor(
    @Inject(forwardRef(() => PlanService))
    private readonly planService: PlanService,
  ) {}

  // TODO: implement realtime ETA polling and caching
}
