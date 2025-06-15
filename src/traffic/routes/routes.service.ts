import {
  Injectable,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as polyline from '@mapbox/polyline';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import { TagoService } from '../tago/tago.service';
import { ItsService } from '../its/its.service';
import { LinkMappingService } from '../its/link-mapping.service';
import { RouteDto } from './dto/route-info.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { SavedRoute } from './entities/saved-route.entity';

import {
  OtpPlanResponse,
  OtpPlan,
  Itinerary,
  Leg,
} from './interfaces/otp.interfaces';

// 내부 서비스용 RawRoutes 타입 정의
type RawRoutes = Record<
  'walk' | 'car' | 'subway' | 'bus' | 'bus_subway',
  RouteDto[]
>;

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
    private readonly tagoService: TagoService,
    private readonly itsService: ItsService,
    private readonly mapper: LinkMappingService,
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
    @InjectRepository(SavedRoute)
    private readonly savedRouteRepo: Repository<SavedRoute>,
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
      date?: string;
      time?: string;
      arriveBy?: boolean;
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
      numItineraries: options?.numItineraries ?? 4,
      // 허용할 최대 도보 거리(m)
      maxWalkDistance: options?.maxWalkDistance ?? 2000,
      // 허용할 최대 환승 횟수
      maxTransfers: options?.maxTransfers ?? 4,
      // 경로 최적화 기준 (QUICK, TRANSFERS, TRIANGLE 등)
      optimize: options?.optimize ?? 'QUICK',

      showIntermediateStops: true,

      locale: 'ko',
    };
    // mode, transitModes에 공백 포함 시 정리 (예: 'WALK, TRANSIT' -> 'WALK,TRANSIT')
    if (typeof params.mode === 'string') {
      params.mode = params.mode
        .split(',')
        .map((s) => s.trim())
        .join(',');
    }
    if (typeof params.transitModes === 'string') {
      params.transitModes = params.transitModes
        .split(',')
        .map((s) => s.trim())
        .join(',');
    }
    if (options?.date) {
      params.date = options.date;
    }
    if (options?.time) {
      params.time = options.time;
    }
    if (options?.arriveBy !== undefined) {
      params.arriveBy = options.arriveBy;
    }
    try {
      this.logger.log(
        `[RoutesService] Calling OTP URL: ${url} params: ${JSON.stringify(params)}`,
      );
      const response = await firstValueFrom(
        this.httpService.get<OtpPlanResponse>(url, { params }),
      );
      this.logger.log(
        `[RoutesService] OTP raw response: ${JSON.stringify(response.data.plan)}`,
      );
      return response.data.plan;
    } catch (error) {
      this.logger.error(`[RoutesService] OTP API 호출 실패: ${url}`, error);
      throw new HttpException(
        'OTP API 호출 실패',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
  /**
   * 모든 경로를 조회하여 필요한 정보만 반환
   */

  async getAllRoutes(
    fromAddress: string,
    toAddress: string,
    options?: { date?: string; time?: string; arriveBy?: boolean },
  ): Promise<RawRoutes> {
    // 대중교통 조회 시간 조정: 새벽 시간대는 첫차 +30분으로 설정
    const defaultFirstTime = '05:30:00';
    const fallbackOffsetMinutes = 30;
    let transitTimeForQuery = options?.time;
    if (transitTimeForQuery != null && transitTimeForQuery < defaultFirstTime) {
      const [fh, fm] = defaultFirstTime.split(':').map((s) => parseInt(s, 10));
      const dt = new Date();
      dt.setHours(fh, fm, 0, 0);
      dt.setMinutes(dt.getMinutes() + fallbackOffsetMinutes);
      transitTimeForQuery = dt.toTimeString().substring(0, 8);
      this.logger.log(
        `[getAllRoutes] Adjusting transit query time to ${transitTimeForQuery} (first train + ${fallbackOffsetMinutes}min)`,
      );
    }
    // 1) 순수 도보, 대중교통, 자동차 경로 병렬 조회
    const [walkPlan, transitPlan, carPlan] = await Promise.all([
      this.getOtpRoutes(fromAddress, toAddress, {
        mode: 'WALK',
        numItineraries: 1,
        optimize: 'QUICK',
        date: options?.date,
        time: options?.time,
        arriveBy: options?.arriveBy,
      }),
      this.getOtpRoutes(fromAddress, toAddress, {
        mode: 'TRANSIT,WALK',
        transitModes: 'BUS,SUBWAY',
        numItineraries: 4,
        optimize: 'QUICK',
        maxPreTransitTime: 1200,
        maxWalkDistance: 3000,
        date: options?.date,
        time: transitTimeForQuery,
        arriveBy: options?.arriveBy,
      }),
      this.getOtpRoutes(fromAddress, toAddress, {
        mode: 'CAR',
        numItineraries: 1,
        optimize: 'QUICK',
        date: options?.date,
        time: options?.time,
        arriveBy: options?.arriveBy,
      }),
    ]);
    const walkRoutes = walkPlan.itineraries;
    const transitRoutes = transitPlan.itineraries.filter((itin) =>
      (itin.legs ?? []).some((l) => l.transitLeg),
    );
    const carRoutes = carPlan.itineraries.filter((itin) => {
      const modes = new Set((itin.legs ?? []).map((l) => l.mode));
      return modes.has('CAR');
    });

    // 이제 WALK, TRANSIT, CAR 결과를 합쳐서 카테고리별 DTO로 변환합니다.

    // duration 기준 오름차순 정렬
    const sortedItins = [...walkRoutes, ...transitRoutes, ...carRoutes].sort(
      (a, b) => a.duration - b.duration,
    );
    // 전역 transit 경로 geometry coords로 globalLinkIdSet 생성 (its.controller와 동일)
    const globalCoords: { lon: number; lat: number }[] = [];
    for (const itin of sortedItins) {
      for (const leg of itin.legs) {
        if (!leg.transitLeg) continue;
        const pts = (leg as any).legGeometry?.points;
        if (pts) {
          globalCoords.push(
            ...polyline.decode(pts).map(([lat, lon]) => ({ lon, lat })),
          );
        }
      }
    }
    const globalLinkIdSet = new Set<string>();
    globalCoords.forEach(({ lon, lat }, idx) => {
      const id = this.mapper.findLinkId(lon, lat);
      console.log(
        `[getAllRoutes][ITS] globalCoord[${idx}] lon:${lon}, lat:${lat} -> linkId:${id}`,
      );
      if (id) globalLinkIdSet.add(id);
    });
    console.log(
      '[getAllRoutes][ITS] globalLinkIdSet:',
      Array.from(globalLinkIdSet),
    );
    // 카테고리별 분류
    const categories: { [key: string]: Itinerary[] } = {
      walk: [],
      car: [],
      subway: [],
      bus: [],
      bus_subway: [],
    };
    for (const itin of sortedItins) {
      const modes = Array.from(new Set((itin.legs ?? []).map((l) => l.mode)));
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
      const transitLegs: Leg[] = legs.filter(
        (l) => l.transitLeg && !!l.routeShortName,
      );
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
      transitLegs.forEach(
        (leg: Leg) => leg.from?.name && stops.push(leg.from.name),
      );
      if (transitLegs.length)
        stops.push(transitLegs[transitLegs.length - 1].to.name);
      // 실시간 도착 예상 시간 조회 및 노선 정보 수집
      const rawRealtimeArrival: (number | null)[] = [];
      const routeInfos: any[] = [];
      let extractedStartVehicleTime: string | undefined;
      let extractedRouteType: string | undefined;
      let extractedCityCode: string | undefined;
      let extractedNodeId: string | undefined;
      let extractedRouteId: string | undefined;

      for (const leg of transitLegs) {
        if (leg.mode === 'SUBWAY') {
          const start = leg.startTime ?? now;
          rawRealtimeArrival.push(
            Math.max(0, Math.floor((start - now) / 1000)),
          );
          continue;
        }

        try {
          const nodeId = leg.from.stopId?.split('TAGO_')[1] ?? '';
          // routeId가 없으면 routeShortName(버스 번호)으로 대체
          const routeId =
            leg.routeId?.split('TAGO_')[1] ?? leg.routeShortName ?? '';

          // 첫 번째 버스 leg에서만 정보 추출
          if (!extractedNodeId && nodeId) {
            extractedNodeId = nodeId;
            console.log(
              `[getAllRoutes][BusInfo] Extracted nodeId: ${extractedNodeId}`,
            );
          }
          if (!extractedRouteId && routeId) {
            extractedRouteId = routeId;
            console.log(
              `[getAllRoutes][BusInfo] Extracted routeId: ${extractedRouteId}`,
            );
          }

          const cityCode = await this.tagoService.getCityCodeFromBusStop(
            leg.from.lat.toString(),
            leg.from.lon.toString(),
            nodeId,
          );

          if (!extractedCityCode && cityCode) {
            extractedCityCode = cityCode;
            console.log(
              `[getAllRoutes][BusInfo] Extracted cityCode: ${extractedCityCode}`,
            );
          }

          console.log(
            `[getAllRoutes][BusArrivals] Requesting Tago realtime for nodeId=${nodeId}, routeId=${routeId}`,
          );
          const res = await this.tagoService.getRealtimeBusArrivals(
            cityCode,
            nodeId,
            routeId,
          );
          console.log(
            `[getAllRoutes][BusArrivals] Raw Tago response for nodeId=${nodeId}, routeId=${routeId}:`,
            res.data,
          );

          // 버스 노선 기본 정보 조회
          try {
            console.log(
              `[getAllRoutes][RouteInfo] Attempting to get route info for cityCode=${cityCode}, routeId=${routeId}`,
            );
            const routeInfoRes = await this.tagoService.getRouteInfoItem(
              cityCode,
              routeId,
            );
            console.log(
              `[getAllRoutes][RouteInfo] Route info response for cityCode=${cityCode}, routeId=${routeId}:`,
              JSON.stringify(routeInfoRes.data, null, 2),
            );

            // XML 응답인 경우 파싱 시도
            const routeInfo = routeInfoRes.data?.response?.body?.items?.item;
            const isError =
              typeof routeInfoRes.data === 'string' &&
              routeInfoRes.data.includes('SERVICE_ACCESS_DENIED_ERROR');

            if (routeInfo && !isError) {
              // 중복 제거를 위해 routeId로 확인
              const existingRoute = routeInfos.find(
                (info) => info.routeid === routeInfo.routeid,
              );
              if (!existingRoute) {
                routeInfos.push({
                  ...routeInfo,
                  routeShortName: leg.routeShortName, // 버스 번호도 함께 저장
                });
                console.log(
                  `[getAllRoutes][RouteInfo] Added route info to main for route ${routeId}`,
                );
              }

              // startvehicletime과 routetp 추출 (노선 정보가 유효할 때만)
              if (!extractedStartVehicleTime && routeInfo.startvehicletime) {
                // TAGO API는 HHMM 형식으로 제공 (예: "0600") -> HH:MM:SS 형식으로 변환
                const timeStr = routeInfo.startvehicletime
                  .toString()
                  .padStart(4, '0');
                const hours = timeStr.substring(0, 2);
                const minutes = timeStr.substring(2, 4);
                extractedStartVehicleTime = `${hours}:${minutes}:00`;
                console.log(
                  `[getAllRoutes][RouteInfo] Extracted startvehicletime from TAGO API: ${routeInfo.startvehicletime} -> ${extractedStartVehicleTime}`,
                );
              }
              if (!extractedRouteType && routeInfo.routetp) {
                extractedRouteType = routeInfo.routetp;
                console.log(
                  `[getAllRoutes][RouteInfo] Extracted routetp from TAGO API: ${extractedRouteType}`,
                );
              }

              // 노선 정보에서 다른 필드들도 확인 (endvehicletime 등)
              if (!extractedStartVehicleTime) {
                const altTimeFields = [
                  routeInfo.firstVehicleTime,
                  routeInfo.firstvehicletime,
                  routeInfo.startVehicleTime,
                  routeInfo.endvehicletime, // 막차시간도 확인
                ];

                for (const timeField of altTimeFields) {
                  if (timeField) {
                    const timeStr = timeField.toString().padStart(4, '0');
                    const hours = timeStr.substring(0, 2);
                    const minutes = timeStr.substring(2, 4);
                    extractedStartVehicleTime = `${hours}:${minutes}:00`;
                    console.log(
                      `[getAllRoutes][RouteInfo] Extracted startvehicletime from alternative field: ${timeField} -> ${extractedStartVehicleTime}`,
                    );
                    break;
                  }
                }
              }
            } else {
              console.warn(
                `[getAllRoutes][RouteInfo] Failed to get valid route info - Error response or access denied`,
              );
              // API 접근 실패 시 기본값 설정 (HH:MM:SS 형식)
              if (!extractedStartVehicleTime) {
                extractedStartVehicleTime = '05:30:00'; // 일반적인 버스 첫 운행 시간
                console.log(
                  `[getAllRoutes][RouteInfo] Set default startvehicletime: ${extractedStartVehicleTime}`,
                );
              }
            }
          } catch (error) {
            console.warn(
              `[getAllRoutes][RouteInfo] Failed to get route info for cityCode=${cityCode}, routeId=${routeId}:`,
              error.message,
            );
            // API 호출 실패 시 기본값 설정
            if (!extractedStartVehicleTime) {
              extractedStartVehicleTime = '05:30:00'; // 일반적인 버스 첫 운행 시간
              console.log(
                `[getAllRoutes][RouteInfo] Set fallback startvehicletime: ${extractedStartVehicleTime}`,
              );
            }
          }

          const items = res.data.response.body.items?.item;
          const list = Array.isArray(items) ? items : items ? [items] : [];
          const earliest =
            list.length > 0
              ? list.reduce((prev: any, curr: any) =>
                  curr.arrtime < prev.arrtime ? curr : prev,
                )
              : null;

          // 실시간 버스 정보에서 routetp 추출
          if (earliest) {
            if (!extractedRouteType && earliest.routetp) {
              extractedRouteType = earliest.routetp;
              console.log(
                `[getAllRoutes][BusArrivals] Extracted routetp from realtime: ${extractedRouteType}`,
              );
            }
          }

          rawRealtimeArrival.push(earliest?.arrtime ?? null);
        } catch {
          rawRealtimeArrival.push(null);
        }
      }

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
        routeInfos,
        startvehicletime: extractedStartVehicleTime,
        routetp: extractedRouteType,
        cityCode: extractedCityCode,
        nodeId: extractedNodeId,
        routeId: extractedRouteId,
      };

      console.log(`[getAllRoutes][Main] Final main object for route:`, {
        startvehicletime: extractedStartVehicleTime,
        routetp: extractedRouteType,
        cityCode: extractedCityCode,
        nodeId: extractedNodeId,
        routeId: extractedRouteId,
      });
      const sub = legs.map((l) => ({
        mode: l.mode,
        transitLeg: l.transitLeg,
        from: l.from,
        to: l.to,
        legGeometry: l.legGeometry,
        steps: l.steps,
        // intermediateStops 포함
        intermediateStops: (l as any).intermediateStops ?? [],
        // routeInfo는 이제 main에 집계되므로 sub에서 제거
      }));
      return { main, sub };
    };
    // 각 카테고리별 RouteDto 생성
    const walk = await Promise.all(categories.walk.map(mapItinToRoute));
    const car = await Promise.all(categories.car.map(mapItinToRoute));
    const subway = await Promise.all(categories.subway.map(mapItinToRoute));
    const bus = await Promise.all(categories.bus.map(mapItinToRoute));
    const bus_subway = await Promise.all(
      categories.bus_subway.map(mapItinToRoute),
    );
    // ITS 로직을 제거하고, 해당 필드를 null로 처리합니다
    const allRoutes: RawRoutes = { walk, car, subway, bus, bus_subway };
    for (const key of Object.keys(allRoutes) as (keyof RawRoutes)[]) {
      for (const route of allRoutes[key]) {
        (route.main as any).trafficItems = [];
        (route.main as any).forecast = [];
      }
    }
    return allRoutes;
  }

  /**
   * 저장된 경로 상세 조회
   */
  async getRouteDetailById(routeId: string): Promise<Route> {
    // Look up the saved route record by its ID and return the nested Route entity
    const saved = await this.savedRouteRepo.findOne({
      where: { id: routeId },
      relations: ['route'],
    });
    if (!saved) {
      throw new NotFoundException(`SavedRoute ${routeId} not found`);
    }
    return saved.route;
  }
}
