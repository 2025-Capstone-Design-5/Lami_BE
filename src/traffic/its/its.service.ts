import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ItsService {
  constructor(private readonly http: HttpService) {}

  /** ITS 교통소통정보 API 호출 */
  async getRealtimeTrafficInfo(params: {
    type: string;
    drcType?: string;
    getType: 'json' | 'xml';
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): Promise<any> {
    const url = 'https://openapi.its.go.kr:9443/trafficInfo';
    const allParams = { apiKey: process.env.ITS_API_KEY, ...params };
    const response = await firstValueFrom(
      this.http.get<any>(url, { params: allParams }),
    );
    return response.data;
  }

  /** ITS 우회도로 예측정보 API 호출 */
  async getForecastInfo(params: {
    sectionId: string;
    fCastDate: string;   // YYYYMMDD
    fCastHour: string;   // HH
    getType: 'json' | 'xml';
  }): Promise<any> {
    const url = 'https://openapi.its.go.kr:9443/bypassFCastInfo';
    const allParams = { apiKey: process.env.ITS_API_KEY, ...params };
    const response = await firstValueFrom(
      this.http.get<any>(url, { params: allParams }),
    );
    console.log(response.data);
    return response.data;
  }
} 