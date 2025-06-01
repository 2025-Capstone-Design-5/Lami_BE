import { Controller, Post, Body } from '@nestjs/common';
import { RoutesService } from './routes.service';

@Controller('traffic/debug/routes')
export class DebugRoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  async getOtpRoutes(
    @Body('from') from: string,
    @Body('to') to: string,
    @Body('date') date: string = new Date().toISOString().slice(0, 10),
    @Body('time') time: string,
    @Body('arriveBy') arriveBy: boolean,
    @Body('mode') mode: string = 'TRANSIT,WALK',
    @Body('transitModes') transitModes?: string,
    @Body('maxPreTransitTime') maxPreTransitTime?: number,
    @Body('numItineraries') numItineraries?: number,
    @Body('maxWalkDistance') maxWalkDistance?: number,
    @Body('maxTransfers') maxTransfers?: number,
    @Body('optimize') optimize: string = 'QUICK',

  ): Promise<any> {
    return this.routesService.getOtpRoutes(from, to, {
      mode,
      transitModes,
      maxPreTransitTime,
      numItineraries,
      maxWalkDistance,
      maxTransfers,
      optimize,
      date,
      time,
      arriveBy,
    });
  }
}
