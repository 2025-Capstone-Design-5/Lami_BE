import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import { TagoService } from '../tago/tago.service';
import { RoutesResponseDto, RouteDto } from './dto/route-info.dto';
import { OtpPlanResponse, OtpPlan, Itinerary, Leg } from './interfaces/otp.interfaces';

@Injectable()
export class RoutesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
    private readonly tagoService: TagoService,
  ) {}

  async getOtpRoutes(fromAddress: string, toAddress: string): Promise<OtpPlan> {
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
      this.httpService.get<OtpPlanResponse>(url, { params }),
    );
    console.log('[RoutesService] OTP raw response:', response.data.plan);
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
    const itineraries: Itinerary[] = data.itineraries ?? [];
    // duration 기준 사전 정렬 후 상위 3개(best) 및 최하위 1개(worst) 선별
    const sortedItins = [...itineraries].sort((a, b) => a.duration - b.duration);
    const bestItins = sortedItins.slice(0, 3);
    const worstItin = sortedItins[sortedItins.length - 1];
    const selectedItins = [...bestItins];
    if (!bestItins.includes(worstItin)) selectedItins.push(worstItin);
    // 최종 선택된 Itinerary에 대해 static + realtime 처리 병렬화
    const routes = await Promise.all(
      selectedItins.map(async (itin: Itinerary) => {
        const legs: Leg[] = itin.legs ?? [];
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
          if (mode === 'WALK') walkDurations.push(sum);
          else if (legs[idx - 1].transitLeg) transitDurations.push(sum);
        }
        // stops 및 transfers 수집
        const stops: string[] = [];
        const transitLegs: Leg[] = legs.filter(l => l.transitLeg && !!l.routeShortName);
        const transfers: any[] = [];
        const now = Date.now();
        for (let i = 1; i < transitLegs.length; i++) {
          const prev = transitLegs[i - 1];
          const curr = transitLegs[i];
          if (!curr.interlineWithPreviousLeg) {
            const departure = curr.from.departure ?? curr.startTime ?? now;
            const previousArrival = prev.to.arrival ?? prev.to.endTime ?? now;
            transfers.push({
              stationName: curr.from.name,
              fromRoute: prev.routeShortName,
              toRoute: curr.routeShortName,
              departureTime: departure,
              waitTime: (departure - previousArrival) / 1000,
            });
          }
        }
        transitLegs.forEach((leg: Leg) => leg.from?.name && stops.push(leg.from.name));
        if (transitLegs.length) stops.push(transitLegs[transitLegs.length - 1].to.name);
        // 실시간 도착 예상 시간 조회
        const realtimeArrivalTimes: (number | null)[] = await Promise.all(
          transitLegs.map(async (leg: Leg) => {
            if (leg.mode === 'SUBWAY') {
              const start = leg.startTime ?? now;
              return Math.max(0, Math.floor((start - now) / 1000));
            }
            try {
              const nodeId = leg.from.stopId?.split('TAGO_')[1] ?? '';
              const routeId = leg.routeId?.split('TAGO_')[1] ?? '';
              const cityCode = await this.tagoService.getCityCodeFromBusStop(
                leg.from.lat.toString(),
                leg.from.lon.toString(),
                nodeId,
              );
              const res = await this.tagoService.getRealtimeBusArrivals(cityCode, nodeId, routeId);
              const items = res.data.response.body.items?.item;
              const list = Array.isArray(items) ? items : items ? [items] : [];
              const earliest = list.length > 0
                ? list.reduce((prev: any, curr: any) => (curr.arrtime < prev.arrtime ? curr : prev))
                : null;
              return earliest?.arrtime ?? null;
            } catch {
              return null;
            }
          }),
        );
        // Main/Sub 조합
        const main = {
          origin: fromAddress,
          destination: toAddress,
          stops,
          duration,
          walkDurations,
          transitDurations,
          routeShortNames: transitLegs.map((l: Leg) => l.routeShortName),
          modes: legs.map((l: Leg) => l.mode),
          transferCount: transfers.length,
          transfers,
          realtimeArrivalTimes,
        };
        const sub = legs.map(l => ({
          mode: l.mode,
          transitLeg: l.transitLeg,
          from: l.from,
          to: l.to,
          legGeometry: l.legGeometry as unknown,
          steps: l.steps as unknown[],
        }));
        return { main, sub };
      }),
    );
    // 최선/최악 경로 반환
    const best = routes.slice(0, bestItins.length);
    const worst = routes[routes.length - 1];
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