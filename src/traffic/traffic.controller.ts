import { Controller } from '@nestjs/common';
import { TrafficService } from './traffic.service';


@Controller('traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}
}
