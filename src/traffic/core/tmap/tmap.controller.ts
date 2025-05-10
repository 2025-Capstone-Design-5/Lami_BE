import { Controller, Get, Query } from '@nestjs/common';
import { TmapService } from './tmap.service';

@Controller('tmap')
export class TmapController {
  constructor(private readonly tmapService: TmapService) {}

  /**
   * 테스트용 주소 geocoding 엔드포인트
   * 예: GET /tmap/geocode?address=서울특별시 중구
   */
  @Get('geocode')
  async geocode(
    @Query('version') version: string,
    @Query('city_do') city_do: string,
    @Query('gu_gun') gu_gun: string,
    @Query('dong') dong: string,
    @Query('bunji') bunji?: string,
    @Query('detailAddress') detailAddress?: string,
    @Query('addressFlag') addressFlag?: string,
    @Query('coordType') coordType?: string,
    @Query('callback') callback?: string,
  ) {
    return this.tmapService.geocode({
      version,
      city_do,
      gu_gun,
      dong,
      bunji,
      detailAddress,
      addressFlag,
      coordType,
      callback,
    });
  }
} 