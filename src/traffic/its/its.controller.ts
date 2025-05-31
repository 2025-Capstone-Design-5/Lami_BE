import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { TmapService } from '../tmap/tmap.service';
import { RoutesService } from '../routes/routes.service';
import { ItsService } from './its.service';
import { LinkMappingService } from './link-mapping.service';
import { SECTION_INFO } from './section-map';
// @ts-ignore
import polyline = require('@mapbox/polyline');
import * as fs from 'fs';
import * as path from 'path';
import type { FeatureCollection } from 'geojson';

@Controller('traffic/its')
export class ItsController {
  constructor(
    private readonly tmap: TmapService,
    private readonly routesService: RoutesService,
    private readonly itsService: ItsService,
    private readonly mapper: LinkMappingService,
  ) {}

  @Post('by-route')
  async getTrafficByRoute(
    @Body() body: {
      from: string;
      to: string;
      date?: string;
      time: string;
      arriveBy?: boolean;
      mode?: string;
      radius?: string;
      transitModes?: string;
      maxPreTransitTime?: number;
      numItineraries?: number;
      maxWalkDistance?: number;
      maxTransfers?: number;
      optimize?: string;
    }
  ): Promise<{ totalCount: number; items: any[]; itineraries: any[] }> {
    // 1) OTP 경로 조회
    const {
      from,
      to,
      date = new Date().toISOString().slice(0, 10),
      time,
      arriveBy,
      mode = 'TRANSIT,WALK',
      transitModes,
      maxPreTransitTime,
      numItineraries,
      maxWalkDistance,
      maxTransfers,
      optimize = 'QUICK',
      radius = '0.001',
    } = body;
    const plan = await this.routesService.getOtpRoutes(from, to, {
      mode,
      transitModes,
      maxPreTransitTime,
      numItineraries,
      maxWalkDistance,
      maxTransfers,
      optimize,
      date,
      time,
      arriveBy,
    });
    console.log(`[getTrafficByRoute] OTP itineraries count: ${plan.itineraries.length}`, plan.itineraries);
    const coords: { lon: number; lat: number }[] = [];
    for (const itin of plan.itineraries) {
      for (const leg of itin.legs) {
        // 오직 transitLeg(버스/지하철) 경로만 처리
        if (!leg.transitLeg) continue;
        const pts = (leg as any).legGeometry?.points;
        if (pts) {
          coords.push(...polyline.decode(pts).map(([lat, lon]) => ({ lon, lat })));
        }
      }
    }
    console.log(`[getTrafficByRoute] extracted transit coords count: ${coords.length}`);

    // 2) linkId 집합 생성
    const linkIdSet = new Set<string>();
    coords.forEach(({ lon, lat }) => {
      const id = this.mapper.findLinkId(lon, lat);
      console.log(`[getTrafficByRoute] coord lon:${lon}, lat:${lat} -> linkId:${id}`);
      if (id) linkIdSet.add(id);
    });
    // 링크 ID가 없으면 결과 없음
    if (linkIdSet.size === 0) {
      return { totalCount: 0, items: [], itineraries: [] };
    }

    // 3~4) 각 이터너러리별로 Bounding Box 계산 및 ITS API 호출
    const itemMap = new Map<string, any>();
    const itineraryResults: any[] = [];
    const r = Number(radius);
    for (let idx = 0; idx < plan.itineraries.length; idx++) {
      const itin = plan.itineraries[idx];
      // Itinerary 버스 경유 정류소 목록 및 stop->linkId 매핑 (intermediateStops 사용)
      const transitLegs = itin.legs.filter(l => l.transitLeg);
      // transit 경로만 처리, 도보 전용은 건너뜀
      if (transitLegs.length === 0) continue;
      const stops = transitLegs.flatMap(l => {
        const inter: Array<any> = (l as any).intermediateStops ?? [];
        return inter.length > 0
          ? inter
          : [{ name: l.from.name, lat: l.from.lat, lon: l.from.lon }];
      });
      const stopNames = stops.map(s => s.name);
      console.log(`[getTrafficByRoute] Itin ${idx+1} stops: ${stopNames.join(', ')}`);
      const stopMappings = stops.map(s => {
        const id = this.mapper.findLinkId(s.lon, s.lat);
        return `${s.name}(${id ?? 'null'})`;
      });
      console.log(`[getTrafficByRoute] Itin ${idx+1} stop->linkId: ${stopMappings.join(' - ')}`);
      // 이터너러리별 경로 좌표 추출
      const itinCoords: { lon: number; lat: number }[] = [];
      for (const leg of itin.legs) {
        const pts = (leg as any).legGeometry?.points;
        if (pts) {
          itinCoords.push(...polyline.decode(pts).map(([lat, lon]) => ({ lon, lat })));
        }
      }
      // 버스 경유 정류소가 있으면 해당 좌표로, 없으면 전체 경로 coords로 박스 계산
      const boundingCoords = stops.length > 0
        ? stops.map(s => ({ lon: s.lon, lat: s.lat }))
        : itinCoords;
      const lonsI = boundingCoords.map(p => p.lon);
      const latsI = boundingCoords.map(p => p.lat);
      const paramsI = {
        type: 'all',
        getType: 'json' as 'json',
        minX: Math.min(...lonsI) - r,
        maxX: Math.max(...lonsI) + r,
        minY: Math.min(...latsI) - r,
        maxY: Math.max(...latsI) + r,
      };
      console.log(`[getTrafficByRoute] Itin ${idx+1} bounding box: ${JSON.stringify(paramsI)}`);
      const resI = await this.itsService.getRealtimeTrafficInfo(paramsI);
      const bodyI = resI?.response?.body ?? resI?.body;
      const rawItemsI = bodyI?.items?.item ?? bodyI?.items ?? [];
      const itemsI = Array.isArray(rawItemsI) ? rawItemsI : [rawItemsI];
      const foundIdsI: string[] = [];
      for (const item of itemsI) {
        if (linkIdSet.has(item.linkId)) {
          itemMap.set(item.linkId, item);
          foundIdsI.push(item.linkId);
        }
      }
      console.log(`[getTrafficByRoute] Itin ${idx+1} matched linkIds: ${foundIdsI.join(', ')}`);
      const matchedItemsI = itemsI.filter(item => foundIdsI.includes(item.linkId));
      itineraryResults.push({
        itineraryIndex: idx + 1,
        stops: stopNames,
        matchedLinkIds: foundIdsI,
        items: matchedItemsI,
      });
    }
    const finalItems = Array.from(itemMap.values());
    return { totalCount: finalItems.length, items: finalItems, itineraries: itineraryResults };
  }

  @Post('realtime')
  async getRealtimeByAddress(
    @Body('address') address: string,
  ) {
    const geo = await this.tmap.geocode(address);
    const lat = parseFloat(geo.coordinateInfo.lat);
    const lon = parseFloat(geo.coordinateInfo.lon);
    const buffer = 0.001;
    const params = {
      type: 'all',
      getType: 'json' as 'json',
      minX: lon - buffer,
      maxX: lon + buffer,
      minY: lat - buffer,
      maxY: lat + buffer,
    };
    return this.itsService.getRealtimeTrafficInfo(params);
  }

  /**
   * ITS 우회도로 예측정보 조회
   */
  @Post('forecast')
  async getForecastInfo(
    @Body('linkIds') linkIds: string[],
    @Body('fCastDate') fCastDate: string,
    @Body('fCastHour') fCastHour: string,
    @Body('getType') getType: 'json' | 'xml' = 'json',
  ): Promise<Record<string, any>> {
    console.log('[getForecast] handler entry');
    if (!Array.isArray(linkIds) || linkIds.length === 0) {
      throw new BadRequestException('linkIds 배열을 전달하세요');
    }
    // linkId -> sectionId 매핑 및 섹션별 linkIds 그룹화
    console.log(`[getForecast] received linkIds: ${linkIds.join(', ')}`);
    console.log(`[getForecast] parameters fCastDate=${fCastDate}, fCastHour=${fCastHour}, getType=${getType}`);
    const linkIdsBySection: Record<string, string[]> = {};
    for (const linkId of linkIds) {
      // linkId -> sectionId 매핑 (always use SECTION_INFO based on reverse geocode)
      let sid: string | null = null;
        const coord = this.mapper.getCoordinatesByLinkId(linkId);
        if (coord) {
          const rev = await this.tmap.reverseGeocode(coord.lat.toString(), coord.lon.toString());
          const city = rev.coordinateInfo.city_do;
          const gu = rev.coordinateInfo.gu_gun;
          sid = Object.entries(SECTION_INFO)
          .find(([sec, infos]) => infos.some(info => info.sido.trim() === city.trim() && info.sigungu.trim() === gu.trim()))?.[0] ?? null;
        console.log(`[getForecast] linkId ${linkId} reverse geocode -> ${city} ${gu} -> sectionId ${sid}`);
      } else {
        console.log(`[getForecast] linkId ${linkId} has no coordinates, cannot map section`);
      }
     
      if (!sid) {
        continue;
      }
     
      if (!linkIdsBySection[sid]) linkIdsBySection[sid] = [];
      linkIdsBySection[sid].push(linkId);
    }
    const uniqueSectionIds = Object.keys(linkIdsBySection);
    console.log(`[getForecast] filtered valid sectionIds: ${uniqueSectionIds.join(', ')}`);
    if (uniqueSectionIds.length === 0) {
      throw new BadRequestException('유효한 sectionId가 없습니다');
    }
    // 각 sectionId별 예측정보 호출 및 linkId 필터링 (순차 호출)
    const result: Record<string, any> = {};
    for (const sectionId of uniqueSectionIds) {
      console.log(`[getForecast] calling itsService.getForecastInfo for sectionId=${sectionId}`);
      const resp = await this.itsService.getForecastInfo({ sectionId, fCastDate, fCastHour, getType });
      // 응답 내 items를 요청한 linkIds로 필터링
      if (resp.body && Array.isArray(resp.body.items)) {
        const filtered = resp.body.items.filter(item => linkIdsBySection[sectionId].includes(item.linkId));
        resp.body.items = filtered;
        resp.body.totalCount = filtered.length;
      }
      result[sectionId] = resp;
    }
    return result;
  }

  /**
   * ITS 우회도로 예측정보 조회(원시)
   */
  @Post('forecast/raw')
  async getRawForecast(
    @Body('sectionId') sectionId: string,
    @Body('fCastDate') fCastDate: string,
    @Body('fCastHour') fCastHour: string,
    @Body('getType') getType: 'json' | 'xml' = 'json',
  ): Promise<any> {
    return this.itsService.getForecastInfo({ sectionId, fCastDate, fCastHour, getType });
  }
} 