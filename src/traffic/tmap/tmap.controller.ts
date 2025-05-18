import { Controller, Post, Body } from '@nestjs/common';
import { TmapService } from './tmap.service';
import { RouteRequestDto } from '../routes/dto/route-request.dto';

@Controller('traffic/tmap')
export class TmapController {
  constructor(private readonly tmapService: TmapService) {}

  @Post('time-machine')
  async getTimeMachine(@Body() dto: RouteRequestDto): Promise<{ travelTime: number }> {
    const travelTime = await this.tmapService.getTimeMachineTravelTime(dto.fromAddress, dto.toAddress);
    return { travelTime };
  }
} 