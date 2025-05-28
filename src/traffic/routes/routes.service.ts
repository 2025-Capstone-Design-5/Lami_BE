import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import { TagoService } from '../tago/tago.service';
import { AllRoutesDataDto } from './dto/all-routes-response.dto';
import { OtpPlanResponse, OtpPlan, Itinerary, Leg } from './interfaces/otp.interfaces';

@Injectable()
export class RoutesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
    private readonly tagoService: TagoService,
  ) {}

  /**
   * OTP Plan 조회 (mode, transitModes 등 옵션 커스터마이징 가능)
   */
  async getOtpRoutes(
    fromAddress: string,
    toAddress: string,
    options?: {
      mode?: string;
      transitModes?: string;
      maxPreTransitTime?: number;
      numItineraries?: number;
      maxWalkDistance?: number;
      maxTransfers?: number;
      optimize?: string;
    },
  ): Promise<OtpPlan> {
    // 1) 주소 -> 좌표 변환 via TmapService (수정된 geocode 함수 사용)
    const fromGeoRes = await this.tmapService.geocode(fromAddress);
    const { lat: fromLat, lon: fromLon } = fromGeoRes.coordinateInfo;

    const toGeoRes = await this.tmapService.geocode(toAddress);
    const { lat: toLat, lon: toLon } = toGeoRes.coordinateInfo;
    
    // 2) OTP API 호출
    const url = `${process.env.OTP_URL}/otp/routers/default/plan`;
    const params: any = {
      fromPlace: `${fromLat},${fromLon}`,
      toPlace: `${toLat},${toLon}`,
      // 기본값
      mode: options?.mode ?? 'TRANSIT,WALK,CAR',
      transitModes: options?.transitModes ?? 'BUS,SUBWAY',
      maxPreTransitTime: options?.maxPreTransitTime ?? 600,
      numItineraries: options?.numItineraries ?? 5,
      // 허용할 최대 도보 거리(m)
      maxWalkDistance: options?.maxWalkDistance ?? 2000,
      // 허용할 최대 환승 횟수
      maxTransfers: options?.maxTransfers ?? 3,
      // 경로 최적화 기준 (QUICK, TRANSFERS, TRIANGLE 등)
      optimize: options?.optimize ?? 'TRIANGLE',

      showIntermediateStops: true,
    };
    console.log(`[RoutesService] Calling OTP URL: ${url}`, params);
    const response = await firstValueFrom(
      this.httpService.get<OtpPlanResponse>(url, { params }),
    );
    console.log('[RoutesService] OTP raw response:', response.data.plan);
    return response.data.plan;
  }
  /**
   * 모든 경로를 조회하여 필요한 정보만 반환
   */
  async getAllRoutes(fromAddress: string, toAddress: string): Promise<AllRoutesDataDto> {
    // 1) 순수 도보, 대중교통, 자동차 경로 병렬 조회
    const [walkPlan, transitPlan, carPlan] = await Promise.all([
      this.getOtpRoutes(fromAddress, toAddress, { mode: 'WALK', numItineraries: 1, optimize: 'QUICK' }),
      this.getOtpRoutes(fromAddress, toAddress, {
        mode: 'TRANSIT,WALK',
        transitModes: 'BUS,SUBWAY',
        numItineraries: 3,
        optimize: 'QUICK',
        maxPreTransitTime: 1200,
      }),
      this.getOtpRoutes(fromAddress, toAddress, { mode: 'CAR', numItineraries: 1, optimize: 'QUICK' }),
    ]);
    const walkRoutes = walkPlan.itineraries;
    // transitLeg 기반 필터링으로 대중교통 경로만 추출
    const transitRoutes = transitPlan.itineraries.filter(itin =>
      (itin.legs ?? []).some(l => l.transitLeg),
    );
    const carRoutes = carPlan.itineraries.filter(itin => {
      const modes = new Set((itin.legs ?? []).map(l => l.mode));
      return modes.has('CAR');
    });

    // 이제 WALK, TRANSIT, CAR 결과를 합쳐서 카테고리별 DTO로 변환합니다.

    // duration 기준 오름차순 정렬
    const sortedItins = [...walkRoutes, ...transitRoutes, ...carRoutes].sort((a, b) => a.duration - b.duration);
    // 카테고리별 분류
    const categories: { [key: string]: Itinerary[] } = {
      walk: [],
      car: [],
      subway: [],
      bus: [],
      bus_subway: [],
    };
    for (const itin of sortedItins) {
      const modes = Array.from(new Set((itin.legs ?? []).map(l => l.mode)));
      const hasCar = modes.includes('CAR');
      const hasBus = modes.includes('BUS') || modes.includes('TRAM');
      const hasSubway = modes.includes('SUBWAY') || modes.includes('RAIL');
      if (hasCar) {
        categories.car.push(itin);
      } else if (!hasBus && !hasSubway) {
        categories.walk.push(itin);
      } else if (hasBus && hasSubway) {
        categories.bus_subway.push(itin);
      } else if (hasSubway) {
        categories.subway.push(itin);
      } else if (hasBus) {
        categories.bus.push(itin);
      }
    }
    // 각 카테고리별 개수 제한 (subway, bus, bus_subway만 2개 이하)
    const limit = (list: Itinerary[]) => list.slice(0, 2);
    categories.subway = limit(categories.subway);
    categories.bus = limit(categories.bus);
    categories.bus_subway = limit(categories.bus_subway);
    // Itinerary -> RouteDto 변환 함수
    const mapItinToRoute = async (itin: Itinerary) => {
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
      const rawRealtimeArrival: (number | null)[] = await Promise.all(
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
      const realtimeArrivalTimes: number[] = rawRealtimeArrival.filter(
        (t): t is number => t !== null,
      );
      // Main/Sub 조합
      const main = {
        origin: fromAddress,
        destination: toAddress,
        stops,
        duration,
        walkDurations,
        transitDurations,
        routeShortNames: transitLegs
          .map((l: Leg) => l.routeShortName)
          .filter((name): name is string => !!name),
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
    };
    // 각 카테고리별 RouteDto 생성
    const walk = await Promise.all(categories.walk.map(mapItinToRoute));
    const car = await Promise.all(categories.car.map(mapItinToRoute));
    const subway = await Promise.all(categories.subway.map(mapItinToRoute));
    const bus = await Promise.all(categories.bus.map(mapItinToRoute));
    const bus_subway = await Promise.all(categories.bus_subway.map(mapItinToRoute));
    return { walk, car, subway, bus, bus_subway };
  }
}