import { Controller, Get, Query } from '@nestjs/common';
import { TagoService } from './tago.service';

@Controller('tago')
export class TagoController {
  constructor(private readonly tagoService: TagoService) {}

  @Get('city-code')
  async getCityCodeFromBusStop(
    @Query('gpsLati') gpsLati: string,
    @Query('gpsLong') gpsLong: string,
    @Query('nodeId') nodeId: string,
  ): Promise<{ cityCode: string }> {
    const cityCode = await this.tagoService.getCityCodeFromBusStop(
      gpsLati,
      gpsLong,
      nodeId,
    );
    return { cityCode };
  }
  @Get('bs-info')
  async getCityCode(
    @Query('gpsLati') gpsLati: string,
    @Query('gpsLong') gpsLong: string,
  ): Promise<any> {
    const response = await this.tagoService.getBusStopInfo(gpsLati, gpsLong);
    return response.data;
  }

  @Get('realtime')
  async getRealtimeArrivals(
    @Query('cityCode') cityCode: string,
    @Query('nodeId') nodeId: string,
    @Query('routeId') routeId: string,
  ): Promise<any> {
    const response = await this.tagoService.getRealtimeBusArrivals(
      cityCode,
      nodeId,
      routeId,
    );
    return response.data;
  }
}
