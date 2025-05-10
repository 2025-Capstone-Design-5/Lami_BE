import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TmapGeocodingResponse } from './interfaces/tmap.interfaces';

@Injectable()
export class TmapService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * 주소 키워드로 geocoding API 호출
   * @param query 검색할 주소 키워드와 관련된 파라미터
   */
  async geocode(query: { version?: string; city_do: string; gu_gun?: string; dong: string; bunji?: string; detailAddress?: string; addressFlag?: string; coordType?: string; callback?: string;}): Promise<TmapGeocodingResponse> {
    const url = process.env.TMAP_GEOCODING_URL || 'https://apis.openapi.sk.com/tmap/geo/geocoding';
    const params: any = {
      version: query.version || '1',
      city_do: query.city_do,
      gu_gun: query.gu_gun,
      dong: query.dong,
      bunji: query.bunji,
      detailAddress: query.detailAddress,
      addressFlag: query.addressFlag || 'F00',
      coordType: query.coordType || process.env.TMAP_COORD_TYPE || 'WGS84GEO',
      appKey: process.env.TMAP_API_KEY,
      callback: query.callback,
    };
    console.log('[TmapService] 요청 URL:', url);
    console.log('[TmapService] 요청 파라미터:', params);
    let rawData: any;
    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(url, {
          params,
          headers: { Accept: 'application/json' },
        }),
      );
      console.log('[TmapService.geocode] 원시 응답 데이터:', response.data);
      rawData = response.data;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new HttpException(
        `[TmapService.geocode] HTTP 요청 실패: ${errMsg}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const coord = rawData.coordinateInfo;
    if (!coord) {
      throw new HttpException(
        '[TmapService.geocode] coordinateInfo가 없습니다',
        HttpStatus.BAD_REQUEST,
      );
    }
    // lat/lon이 없으면 newLat/newLon을 대체 사용
    const lat = coord.lat && coord.lat.trim() !== '' ? coord.lat : coord.newLat;
    const lon = coord.lon && coord.lon.trim() !== '' ? coord.lon : coord.newLon;
    if (!lat || !lon) {
      throw new HttpException(
        `[TmapService.geocode] 유효한 좌표를 찾을 수 없습니다: ${JSON.stringify(coord)}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      coordinateInfo: {
        coordType: coord.coordType,
        addressFlag: coord.addressFlag,
        matchFlag: coord.matchFlag,
        lat,
        lon,
        city_do: coord.city_do,
        gu_gun: coord.gu_gun,
        eup_myun: coord.eup_myun,
        legalDong: coord.legalDong,
        legalDongCode: coord.legalDongCode,
        adminDong: coord.adminDong,
        adminDongCode: coord.adminDongCode,
        ri: coord.ri,
        bunji: coord.bunji,
        newMatchFlag: coord.newMatchFlag,
        newLat: coord.newLat,
        newLon: coord.newLon,
        newRoadName: coord.newRoadName,
        newBuildngIndex: coord.newBuildngIndex,
        newBuildngName: coord.newBuildngName,
        newBuildngCateName: coord.newBuildngCateName,
        remainder: coord.remainder,
      },
    };
  }
}
