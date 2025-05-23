import { Controller, Post, Body } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { RouteRequestDto } from './dto/route-request.dto';
import { AllRoutesDataDto } from './dto/all-routes-response.dto';
import { plainToInstance } from 'class-transformer';

@Controller('traffic/routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  async getAllRoutes(
    @Body() dto: RouteRequestDto,
  ): Promise<AllRoutesDataDto> {
    const data = await this.routesService.getAllRoutes(
      dto.fromAddress,
      dto.toAddress,
    );
    return plainToInstance(AllRoutesDataDto, data);
  }
} 