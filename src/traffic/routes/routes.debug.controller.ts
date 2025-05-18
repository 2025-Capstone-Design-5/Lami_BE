import { Controller, Post, Body } from '@nestjs/common';
import { RoutesService } from './routes.service';

@Controller('traffic/debug/routes')
export class DebugRoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  async getOtpRoutes(
    @Body('from') from: string,
    @Body('to') to: string
  ): Promise<any> {
    return this.routesService.getOtpRoutes(from, to);
  }

  @Post('optimal')
  async getOptimalOtpRoute(
    @Body('from') from: string,
    @Body('to') to: string
  ): Promise<any> {
    return this.routesService.getOptimalOtpRoute(from, to);
  }
} 