import { Controller, Post, Body } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { RouteRequestDto } from './dto/route-request.dto';
import { RoutesResponseDto, RouteDto } from './dto/route-info.dto';
import { plainToInstance } from 'class-transformer';

@Controller('traffic/routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  async getAllRoutes(@Body() dto: RouteRequestDto): Promise<RoutesResponseDto> {
    const data = await this.routesService.getAllRoutes(dto.fromAddress, dto.toAddress);
    return plainToInstance(RoutesResponseDto, data);
  }

  @Post('optimal')
  async getOptimalRoute(@Body() dto: RouteRequestDto): Promise<RouteDto> {
    const data = await this.routesService.getOptimalRoute(dto.fromAddress, dto.toAddress);
    return plainToInstance(RouteDto, data);
  }
} 