import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import { ConfigService } from '@nestjs/config';

@Controller('traffic/otp/routers/:routerId/transmodel/index/graphql')
export class TransmodelGraphqlController {
  private readonly logger = new Logger(TransmodelGraphqlController.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async proxy(
    @Param('routerId') routerId: string,
    @Body() body: { query: string; variables?: Record<string, any> },
  ): Promise<any> {
    // If client provided addresses, geocode to lat/lon
    const vars = body.variables || {};
    if (vars.fromAddress && vars.toAddress) {
      const fromGeo = await this.tmapService.geocode(vars.fromAddress);
      const toGeo = await this.tmapService.geocode(vars.toAddress);
      vars.fromLat = parseFloat(fromGeo.coordinateInfo.lat);
      vars.fromLon = parseFloat(fromGeo.coordinateInfo.lon);
      vars.toLat = parseFloat(toGeo.coordinateInfo.lat);
      vars.toLon = parseFloat(toGeo.coordinateInfo.lon);
      delete vars.fromAddress;
      delete vars.toAddress;
      body.variables = vars;
    }
    // Determine base URL for OTP GraphQL
    const baseUrl = this.configService.get<string>(
      'OTP_BASE_URL',
      'http://localhost:8080',
    );
    const endpoint = `${baseUrl}/otp/routers/${routerId}/transmodel/index/graphql`;
    this.logger.log(
      `Proxy Transmodel GraphQL: ${endpoint}, variables: ${JSON.stringify(body.variables)}`,
    );
    const response = await firstValueFrom(
      this.httpService.post(endpoint, body, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    if (response.data.errors) {
      throw new BadRequestException(response.data.errors);
    }
    return response.data;
  }
}
