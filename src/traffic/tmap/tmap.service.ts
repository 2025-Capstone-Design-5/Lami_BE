import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  TmapGeocodingResponse,
  TmapRouteResponse,
} from './interfaces/tmap.interfaces';

@Injectable()
export class TmapService {
  constructor(private readonly httpService: HttpService) {}

  async geocode(address: string): Promise<TmapGeocodingResponse> {
    // 주소 문자열 파싱
    const parts = address.trim().split(/\s+/);
    const query = {
      city_do: parts[0] || '',
      gu_gun: parts[1] || '',
      dong: parts.slice(2).join(' ') || '',
    };

    const url =
      process.env.GEOCODING_URL ||
      'https://apis.openapi.sk.com/tmap/geo/geocoding';
    const params: any = {
      version: '1',
      city_do: query.city_do,
      gu_gun: query.gu_gun,
      dong: query.dong,
      addressFlag: 'F00',
      coordType: process.env.TMAP_COORD_TYPE || 'WGS84GEO',
      appKey: process.env.TMAP_API_KEY,
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
      const errMsg =
        error instanceof Error ? error.message : JSON.stringify(error);
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

  /**
   * 좌표 기반 reverse geocoding 수행
   */
  async reverseGeocode(
    lat: string,
    lon: string,
  ): Promise<TmapGeocodingResponse> {
    const url =
      process.env.REVERSE_GEOCODING_URL ||
      'https://apis.openapi.sk.com/tmap/geo/reversegeocoding';
    const params: any = {
      version: '1',
      lat: lat,
      lon: lon,
      coordType: process.env.TMAP_COORD_TYPE || 'WGS84GEO',
      addressType: 'A10',
      appKey: process.env.TMAP_API_KEY,
    };
    const response = await firstValueFrom(
      this.httpService.get<any>(url, {
        params,
        headers: { Accept: 'application/json' },
      }),
    );
    const raw = response.data;
    const info = raw.addressInfo || {};
    return {
      coordinateInfo: {
        coordType: params.coordType,
        addressFlag: info.addressType ?? '',
        matchFlag: '',
        lat: lat,
        lon: lon,
        city_do: info.city_do ?? '',
        gu_gun: info.gu_gun ?? '',
        eup_myun: info.eup_myun ?? '',
        legalDong: info.adminDong ?? '',
        legalDongCode: info.adminDongCode ?? '',
        adminDong: info.adminDong ?? '',
        adminDongCode: info.adminDongCode ?? '',
        ri: info.ri ?? '',
        bunji: info.bunji ?? '',
        newMatchFlag: '',
        newLat: '',
        newLon: '',
        newRoadName: '',
        newBuildngIndex: info.buildingIndex ?? '',
        newBuildngName: info.buildingName ?? '',
        newBuildngCateName: '',
        remainder: '',
      },
    };
  }

  /**
   * Tmap Time Machine API를 호출하여 과거 교통 소요 시간을 반환
   * @param fromAddress 출발지 주소
   * @param toAddress 도착지 주소
   */
  async getTimeMachineTravelTime(
    fromAddress: string,
    toAddress: string,
  ): Promise<number> {
    // 출발지, 도착지 좌표 조회
    const fromGeo = await this.geocode(fromAddress);
    const toGeo = await this.geocode(toAddress);
    const startX = fromGeo.coordinateInfo.lon;
    const startY = fromGeo.coordinateInfo.lat;
    const endX = toGeo.coordinateInfo.lon;
    const endY = toGeo.coordinateInfo.lat;
    // Time Machine API URL
    const url =
      process.env.TMAP_PREDICTION_URL ||
      'https://api2.sktelecom.com/tmap/routes/prediction';
    // 요청 페이로드를 routesInfo 구조로 구성 (payload에는 안내 요청 정보만 포함)
    // predictionTime은 YYYY-MM-DDTHH:mm:ss+0900 형식으로 설정
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const predictionTime =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+0900`;
    const payload = {
      routesInfo: {
        departure: {
          name: fromAddress,
          lon: startX,
          lat: startY,
          depSearchFlag: '03',
        },
        destination: {
          name: toAddress,
          lon: endX,
          lat: endY,
          destSearchFlag: '03',
        },
        predictionType: 'departure',
        predictionTime,
        searchOption: '00',
        tollgateCarType: 'car',
      },
    };
    let responseData: any;
    try {
      // Querystring에 version, coordType, totalValue를 포함하여 POST 요청
      const query = `version=1&reqCoordType=${process.env.TMAP_COORD_TYPE || 'WGS84GEO'}&resCoordType=${process.env.TMAP_COORD_TYPE || 'WGS84GEO'}&totalValue=2`;
      const requestUrl = `${url}?${query}`;
      const response = await firstValueFrom(
        this.httpService.post<any>(requestUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            appKey: process.env.TMAP_API_KEY,
          },
        }),
      );
      responseData = response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      // 전체 Tmap 응답 데이터를 로그로 출력
      console.error(
        '[TmapService.getTimeMachineTravelTime] Tmap error response data:',
        data,
      );
      const errorCode =
        data?.errorCode ?? data?.errorcode ?? data?.code ?? 'unknown';
      // 데이터에서 제공되는 메시지 없으면 JSON 문자열화
      const errorMsg =
        data?.errorMessage ?? data?.message ?? JSON.stringify(data);
      if (status === 400) {
        // 잘못된 요청
        throw new HttpException(
          `[TmapService.getTimeMachineTravelTime] Bad Request (${errorCode}): ${errorMsg}`,
          HttpStatus.BAD_REQUEST,
        );
      } else if (status === 500) {
        // 서버 오류
        throw new HttpException(
          `[TmapService.getTimeMachineTravelTime] Internal Server Error (${errorCode}): ${errorMsg}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        // 기타 오류
        throw new HttpException(
          `[TmapService.getTimeMachineTravelTime] HTTP 요청 실패: ${errorMsg}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
    const features = (responseData as TmapRouteResponse).features;
    if (!Array.isArray(features) || features.length === 0) {
      // 데이터 없음
      throw new HttpException(
        '[TmapService.getTimeMachineTravelTime] 예측 경로 정보가 없습니다',
        HttpStatus.NO_CONTENT,
      );
    }
    // totalValue=2로 요청 시 첫 번째 features[0].properties.totalTime 활용
    const totalTime = features[0]?.properties?.totalTime;
    return totalTime;
  }
}
