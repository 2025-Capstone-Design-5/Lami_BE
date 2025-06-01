import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as polyline from '@mapbox/polyline';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import { TagoService } from '../tago/tago.service';
import { ItsService } from '../its/its.service';
import { LinkMappingService } from '../its/link-mapping.service';
import { AllRoutesDataDto } from './dto/all-routes-response.dto';

import {
  OtpPlanResponse,
  OtpPlan,
  Itinerary,
  Leg,
} from './interfaces/otp.interfaces';

@Injectable()
export class RoutesService {
  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
    private readonly tagoService: TagoService,
    private readonly itsService: ItsService,
    private readonly mapper: LinkMappingService,
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
      numItineraries: options?.numItineraries ?? 5,
      // 허용할 최대 도보 거리(m)
      maxWalkDistance: options?.maxWalkDistance ?? 2000,
      // 허용할 최대 환승 횟수
      maxTransfers: options?.maxTransfers ?? 3,
      // 경로 최적화 기준 (QUICK, TRANSFERS, TRIANGLE 등)
      optimize: options?.optimize ?? 'TRIANGLE',

      showIntermediateStops: true,
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

  async getAllRoutes(
    fromAddress: string,
    toAddress: string,
    options?: { date?: string; time?: string; arriveBy?: boolean },
  ): Promise<AllRoutesDataDto> {
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
        numItineraries: 3,
        optimize: 'QUICK',
        maxPreTransitTime: 1200,
        date: options?.date,
        time: options?.time,
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
    // transitLeg 기반 필터링으로 대중교통 경로만 추출
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
      // 실시간 도착 예상 시간 조회
      const rawRealtimeArrival: (number | null)[] = await Promise.all(
        transitLegs.map(async (leg: Leg) => {
          if (leg.mode === 'SUBWAY') {
            const start = leg.startTime ?? now;
            return Math.max(0, Math.floor((start - now) / 1000));
          }
          try {
            const nodeId = leg.from.stopId?.split('TAGO_')[1] ?? '';
            // routeId가 없으면 routeShortName(버스 번호)으로 대체
            const routeId =
              leg.routeId?.split('TAGO_')[1] ?? leg.routeShortName ?? '';
            const cityCode = await this.tagoService.getCityCodeFromBusStop(
              leg.from.lat.toString(),
              leg.from.lon.toString(),
              nodeId,
            );
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
            const items = res.data.response.body.items?.item;
            const list = Array.isArray(items) ? items : items ? [items] : [];
            const earliest =
              list.length > 0
                ? list.reduce((prev: any, curr: any) =>
                    curr.arrtime < prev.arrtime ? curr : prev,
                  )
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
      const sub = legs.map((l) => ({
        mode: l.mode,
        transitLeg: l.transitLeg,
        from: l.from,
        to: l.to,
        legGeometry: l.legGeometry,
        steps: l.steps,
        // intermediateStops 포함
        intermediateStops: (l as any).intermediateStops ?? [],
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
    // ITS 정보 통합 (중복 호출 제거)
    const allRoutes: AllRoutesDataDto = { walk, car, subway, bus, bus_subway };
    // 1) Bounding Box 별 실시간 교통 호출 준비
    const rtPromises = new Map<string, Promise<any>>();
    // 2) 고유 섹션ID 별 예측정보 호출 준비
    const fcSectionIds = new Set<string>();
    // 라우트별 메타데이터 저장 (its.controller와 동일 logic 적용)
    for (const key of Object.keys(allRoutes) as (keyof AllRoutesDataDto)[]) {
      for (const route of allRoutes[key]) {
        // 오직 transitLeg(버스/트램 포함) 경로만 처리
        const transitSub = (route.sub || []).filter((s) => s.transitLeg);
        if (transitSub.length === 0) continue;
        // 경유 정류소 기반 bounding box 계산
        const stopsCoords = transitSub.flatMap((s) => {
          const inter: Array<any> = (s as any).intermediateStops ?? [];
          return inter.length > 0
            ? inter.map((i) => ({ lon: i.lon, lat: i.lat }))
            : [{ lon: s.from.lon, lat: s.from.lat }];
        });
        const buffer = 0.001;
        const lons = stopsCoords.map((c) => c.lon);
        const lats = stopsCoords.map((c) => c.lat);
        const minX = Math.min(...lons) - buffer;
        const maxX = Math.max(...lons) + buffer;
        const minY = Math.min(...lats) - buffer;
        const maxY = Math.max(...lats) + buffer;
        const bboxKey = `${minX}_${maxX}_${minY}_${maxY}`;
        console.log(
          `[getAllRoutes][ITS] Registering realtime call for bboxKey=${bboxKey}, params={minX:${minX},maxX:${maxX},minY:${minY},maxY:${maxY}}`,
        );
        (route as any)._bboxKey = bboxKey;
        rtPromises.set(
          bboxKey,
          this.itsService.getRealtimeTrafficInfo({
            type: 'all',
            getType: 'json',
            minX,
            maxX,
            minY,
            maxY,
          }),
        );
        // its.controller와 동일하게 globalLinkIdSet 사용
        (route as any)._linkIdSet = globalLinkIdSet;
        if ((route as any)._sectionId)
          fcSectionIds.add((route as any)._sectionId);
        // stopsCoords 매핑 로그
        stopsCoords.forEach(({ lon, lat }, idx) => {
          const sid = this.mapper.findLinkId(lon, lat);
          console.log(
            `[getAllRoutes][ITS] category=${key}, stopCoord[${idx}] lon:${lon}, lat:${lat} -> linkId:${sid}`,
          );
        });
      }
    }
    // 실시간 교통정보 호출 실행 및 결과 수집
    const rtResults = new Map<string, any[]>();
    for (const [key, promise] of rtPromises) {
      console.log(
        `[getAllRoutes][ITS] Awaiting realtime promise for bboxKey=${key}`,
      );
      const rt = await promise;
      console.log(
        `[getAllRoutes][ITS] Raw ITS response for bboxKey=${key}:`,
        rt,
      );
      // its.controller와 동일한 parsing 로직 적용
      const body = rt?.response?.body ?? rt?.body ?? rt;
      const rawItems = body?.items?.item ?? body?.items ?? [];
      const itemsArr = Array.isArray(rawItems)
        ? rawItems
        : rawItems
          ? [rawItems]
          : [];
      console.log(
        `[getAllRoutes][ITS] Parsed ITS items for bboxKey=${key}:`,
        itemsArr,
      );
      rtResults.set(key, itemsArr);
    }
    // 예측정보 호출 준비 및 실행
    const fCastDate = options?.date
      ? options.date.replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fCastHour = options?.time
      ? options.time
      : new Date().getHours().toString().padStart(2, '0');
    const fcPromises = new Map<string, Promise<any>>();
    for (const sec of fcSectionIds) {
      fcPromises.set(
        sec,
        this.itsService.getForecastInfo({
          sectionId: sec,
          fCastDate,
          fCastHour,
          getType: 'json',
        }),
      );
    }
    const fcResults = new Map<string, any>();
    for (const [sec, promise] of fcPromises) {
      const fc = await promise;
      fcResults.set(sec, fc?.response?.body ?? fc?.body ?? fc);
    }
    // 결과를 각 라우트에 할당
    for (const key of Object.keys(allRoutes) as (keyof AllRoutesDataDto)[]) {
      for (const route of allRoutes[key]) {
        // linkIdSet이 없으면 ITS 로직 건너뛰고 기본값 설정
        const linkIdSet = (route as any)._linkIdSet as Set<string> | undefined;
        if (!linkIdSet) {
          console.log(
            '[getAllRoutes][ITS] No linkIdSet for route, skipping ITS for category',
            key,
          );
          route.main.trafficItems = [0];
          route.main.forecast = [0];
          delete (route as any)._bboxKey;
          delete (route as any)._sectionId;
          delete (route as any)._linkIdSet;
          continue;
        }
        const bboxKey = (route as any)._bboxKey;
        const allItems = rtResults.get(bboxKey) ?? [];
        // ITS 실시간 교통정보 filter 전 globalLinkIdSet 확인
        console.log(
          '[getAllRoutes][ITS] globalLinkIdSet:',
          Array.from(linkIdSet),
        );
        const filteredItems = allItems.filter((item) =>
          linkIdSet.has(item.linkId),
        );
        console.log(
          '[getAllRoutes][ITS] filteredItems:',
          filteredItems.map((it: any) => it.linkId),
        );
        if (filteredItems.length > 0) {
          route.main.trafficItems = filteredItems;
        } else if (allItems.length > 0) {
          console.log(
            '[getAllRoutes][ITS] No intersection, using all ITS items',
          );
          route.main.trafficItems = allItems;
        } else {
          route.main.trafficItems = [0];
        }
        const sec = (route as any)._sectionId;
        // ITS 예측정보 filter 및 없으면 [0]로 대체
        let forecastItems: any[] = [];
        if (sec) {
          const rawFc = fcResults.get(sec);
          const itemsAny = rawFc?.items?.item ?? rawFc?.items ?? [];
          const itemsArr = Array.isArray(itemsAny) ? itemsAny : [itemsAny];
          forecastItems = itemsArr.filter((item) => linkIdSet.has(item.linkId));
        }
        route.main.forecast = forecastItems.length > 0 ? forecastItems : [0];
        delete (route as any)._bboxKey;
        delete (route as any)._sectionId;
        delete (route as any)._linkIdSet;
      }
    }
    return allRoutes;
  }
}
