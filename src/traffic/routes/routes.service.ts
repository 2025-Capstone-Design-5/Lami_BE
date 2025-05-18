import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import { TagoService } from '../tago/tago.service';
import { RoutesResponseDto, RouteDto } from './dto/route-info.dto';

@Injectable()
export class RoutesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
    private readonly tagoService: TagoService,
  ) {}

  async getOtpRoutes(fromAddress: string, toAddress: string): Promise<any> {
    // 1) 주소 -> 좌표 변환 via TmapService (수정된 geocode 함수 사용)
    const fromGeoRes = await this.tmapService.geocode(fromAddress);
    const { lat: fromLat, lon: fromLon } = fromGeoRes.coordinateInfo;

    const toGeoRes = await this.tmapService.geocode(toAddress);
    const { lat: toLat, lon: toLon } = toGeoRes.coordinateInfo;
    
    // 2) OTP API 호출
    const url = `${process.env.OTP_URL}/otp/routers/default/plan`;
    const params = {
      fromPlace: `${fromLat},${fromLon}`,
      toPlace: `${toLat},${toLon}`,
      mode: 'TRANSIT,WALK',
      transitModes: 'BUS,SUBWAY',
    };
    console.log(`[RoutesService] Calling OTP URL: ${url}`, params);
    const response = await firstValueFrom(
      this.httpService.get<any>(url, { params }),
    );
    console.log('[RoutesService] OTP raw response:', response.data);
    return response.data.plan;
  }


  /**
   * 조회된 Itinerary 중 duration이 가장 짧은 최적 경로 반환
   */
  async getOptimalOtpRoute(fromAddress: string, toAddress: string): Promise<any> {
    // 최적의 단일 itinerary 반환
    const plan = await this.getOtpRoutes(fromAddress, toAddress);
    const itineraries = plan.itineraries;
    if (!Array.isArray(itineraries) || itineraries.length === 0) {
      return null;
    }
    return itineraries.reduce(
      (prev: any, curr: any) => (curr.duration < prev.duration ? curr : prev),
      itineraries[0],
    );
  }
  /**
   * 모든 경로를 조회하여 필요한 정보만 반환
   */
  async getAllRoutes(fromAddress: string, toAddress: string): Promise<RoutesResponseDto> {
    const data = await this.getOtpRoutes(fromAddress, toAddress);
    const itineraries = data.itineraries || [];
    // 1) static 처리: main, sub, transitLegs 모으기
    const entries = itineraries.map((itin: any) => {
      const legs = itin.legs || [];
      const duration = itin.duration;
      // 모드별 duration 그룹핑
      const walkDurations: number[] = [];
      const transitDurations: number[] = [];
      let idx = 0;
      while (idx < legs.length) {
        const mode = legs[idx].mode;
        let sum = 0;
        while (idx < legs.length && legs[idx].mode === mode) {
          sum += legs[idx].duration;
          idx++;
        }
        if (mode === 'WALK') {
          walkDurations.push(sum);
        } else if (legs[idx - 1].transitLeg) {
          transitDurations.push(sum);
        }
      }
      // stops, transfers, modes 수집
      const stops: string[] = [];
      const transitLegs = legs.filter((l: any) => l.transitLeg && l.routeShortName);
      const transfers: any[] = [];
      for (let i = 1; i < transitLegs.length; i++) {
        const prev = transitLegs[i - 1];
        const curr = transitLegs[i];
        if (!curr.interlineWithPreviousLeg) {
          transfers.push({
            stationName: curr.from.name,
            fromRoute: prev.routeShortName,
            toRoute: curr.routeShortName,
            departureTime: curr.from.departure ?? curr.startTime,
            waitTime: ((curr.from.departure ?? curr.startTime) - (prev.to.arrival ?? prev.endTime)) / 1000,
          });
        }
      }
      const transferCount = transfers.length;
      const modes = legs.map((l: any) => l.mode);
      transitLegs.forEach((leg: any) => leg.from?.name && stops.push(leg.from.name));
      if (transitLegs.length) stops.push(transitLegs[transitLegs.length - 1].to.name);
      const main: any = { origin: fromAddress, destination: toAddress, stops, duration, walkDurations, transitDurations, routeShortNames: transitLegs.map((l: any) => l.routeShortName), modes, transferCount, transfers };
      const sub = legs.map((l: any) => ({ mode: l.mode, transitLeg: l.transitLeg, from: l.from, to: l.to, legGeometry: l.legGeometry, steps: l.steps }));
      return { main, sub, transitLegs };
    });
    // 2) duration 기준 정렬
    const sorted = entries.sort((a, b) => a.main.duration - b.main.duration);
    const bestEntries = sorted.slice(0, 3);
    const worstEntry = sorted[sorted.length - 1];
    // 3) 실시간 정보는 선택된 경로에 대해서만 fetch
    const fetchRealtime = async (entry: any) => {
      const now = Date.now();
      const times = await Promise.all(
        entry.transitLegs.map(async (leg: any) => {
          if (leg.mode === 'SUBWAY') return Math.max(0, Math.floor((leg.startTime - now) / 1000));
          try {
            const nodeId = leg.from.stopId.split('TAGO_')[1];
            const routeId = leg.routeId.split('TAGO_')[1];
            const cityCode = await this.tagoService.getCityCodeFromBusStop(leg.from.lat.toString(), leg.from.lon.toString(), nodeId);
            const res = await this.tagoService.getRealtimeBusArrivals(cityCode, nodeId, routeId);
            const items = res.data.response.body.items?.item;
            const list = Array.isArray(items) ? items : items ? [items] : [];
            const earliest = list.length ? list.reduce((p: any, c: any) => (c.arrtime < p.arrtime ? c : p)) : null;
            return earliest?.arrtime ?? null;
          } catch {
            return null;
          }
        }),
      );
      entry.main.realtimeArrivalTimes = times;
      return { main: entry.main, sub: entry.sub };
    };
    const best = await Promise.all(bestEntries.map(fetchRealtime));
    const worst = await fetchRealtime(worstEntry);
    return { best, worst } as RoutesResponseDto;
  }

  /**
   * 최적 경로 하나만 반환
   */
  async getOptimalRoute(fromAddress: string, toAddress: string): Promise<RouteDto | null> {
    // best 배열 중 첫 번째 (최단 거리) 경로 반환
    const { best } = await this.getAllRoutes(fromAddress, toAddress);
    if (!Array.isArray(best) || best.length === 0) {
      return null;
    }
    return best[0];
  }
}