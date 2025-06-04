import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class TagoService {
  constructor(private readonly httpService: HttpService) {}

  async getBusStopInfo(
    gpsLati: string,
    gpsLong: string,
    type: 'xml' | 'json' = 'json',
  ): Promise<any> {
    const url =
      'http://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList';
    const params: AxiosRequestConfig = {
      params: {
        serviceKey: process.env.TAGO_API_KEY!,
        pageNo: '1',
        numOfRows: '10',
        _type: type,
        gpsLati,
        gpsLong,
      },
    };
    return firstValueFrom(this.httpService.get(url, params));
  }

  async getCityCodeFromBusStop(
    gpsLati: string,
    gpsLong: string,
    nodeId: string,
  ): Promise<string> {
    // 1) 근접 정류소 정보 호출
    const response = await this.getBusStopInfo(gpsLati, gpsLong);
    // 2) 응답 data 경로
    const entry = response.data.response.body.items?.item;
    const items = Array.isArray(entry) ? entry : entry ? [entry] : [];
    // 3) nodeId 일치 요소 찾기
    const found = items.find((el: any) => el.nodeid === nodeId);
    // 4) 일치 시 citycode, 없으면 기본 메시지 반환
    return found?.citycode ?? '00';
  }

  async getRealtimeBusArrivals(
    cityCode: string,
    nodeId: string,
    routeId: string,
    pageNo: number = 1,
    numOfRows: number = 10,
    type: 'xml' | 'json' = 'json',
  ): Promise<any> {
    const url =
      'http://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoSpcifyRouteBusArvlPrearngeInfoList';
    const params: AxiosRequestConfig = {
      params: {
        serviceKey: process.env.TAGO_API_KEY!,
        pageNo: pageNo.toString(),
        numOfRows: numOfRows.toString(),
        _type: type,
        cityCode,
        nodeId,
        routeId,
      },
    };
    return firstValueFrom(this.httpService.get(url, params));
  }

  /**
   * 노선 기본 정보 조회 (버스노선정보조회 서비스)
   */
  async getRouteInfoItem(
    cityCode: string,
    routeId: string,
    type: 'xml' | 'json' = 'json',
  ): Promise<any> {
    const url =
      'http://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteInfoIem';
    const params: AxiosRequestConfig = {
      params: {
        serviceKey: process.env.TAGO_API_KEY!,
        _type: type,
        cityCode: cityCode,
        routeId: routeId,
      },
      timeout: 10000, // 10초 타임아웃
    };

    console.log(`[TagoService] Calling getRouteInfoItem with URL: ${url}`);
    console.log(`[TagoService] Params:`, params.params);
    console.log(
      `[TagoService] Using serviceKey: ${process.env.TAGO_API_KEY?.substring(0, 10)}...`,
    );

    try {
      const response = await firstValueFrom(this.httpService.get(url, params));
      console.log(`[TagoService] Response status: ${response.status}`);
      console.log(`[TagoService] Response data type:`, typeof response.data);
      console.log(
        `[TagoService] Response data:`,
        JSON.stringify(response.data, null, 2),
      );
      return response;
    } catch (error) {
      console.error(
        `[TagoService] Error calling getRouteInfoItem:`,
        error.message,
      );
      if (error.response) {
        console.error(`[TagoService] Error status:`, error.response.status);
        console.error(`[TagoService] Error response:`, error.response.data);
      }
      throw error;
    }
  }
}
