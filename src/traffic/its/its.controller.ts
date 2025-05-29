import { Controller, Post, Body } from '@nestjs/common';
import { TmapService } from '../tmap/tmap.service';
import { RoutesService } from '../routes/routes.service';
import { ItsService } from './its.service';
import { LinkMappingService } from './link-mapping.service';
// @ts-ignore
import polyline = require('@mapbox/polyline');

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
    @Body('from') from: string,
    @Body('to') to: string,
    @Body('mode') mode: string = 'CAR',
    @Body('radius') radius: string = '0.001',
    @Body('numItineraries') numItineraries?: string,
  ): Promise<{ totalCount: number; items: any[] }> {
    // 1) OTP 경로 조회
    const plan = await this.routesService.getOtpRoutes(from, to, {
      mode,
      ...(numItineraries ? { numItineraries: Number(numItineraries) } : {}),
    });
    console.log(`[getTrafficByRoute] OTP itineraries count: ${plan.itineraries.length}`, plan.itineraries);
    const coords: { lon: number; lat: number }[] = [];
    for (const itin of plan.itineraries) {
      for (const leg of itin.legs) {
        const pts = (leg as any).legGeometry?.points;
        if (pts) {
          coords.push(...polyline.decode(pts).map(([lat, lon]) => ({ lon, lat })));
        }
      }
    }
    console.log(`[getTrafficByRoute] extracted coords count: ${coords.length}`, coords);

    // 2) linkId 집합 생성
    const linkIdSet = new Set<string>();
    coords.forEach(({ lon, lat }) => {
      const id = this.mapper.findLinkId(lon, lat);
      console.log(`[getTrafficByRoute] coord lon:${lon}, lat:${lat} -> linkId:${id}`);
      if (id) linkIdSet.add(id);
    });
    // 링크 ID가 없으면 결과 없음
    if (linkIdSet.size === 0) {
      return { totalCount: 0, items: [] };
    }

    // 3) Bounding Box 계산
    const lons = coords.map(p => p.lon);
    const lats = coords.map(p => p.lat);
    const r = Number(radius);
    const params = {
      type: 'all',
      getType: 'json' as 'json',
      minX: Math.min(...lons) - r,
      maxX: Math.max(...lons) + r,
      minY: Math.min(...lats) - r,
      maxY: Math.max(...lats) + r,
    };

    // 4) ITS API 호출 및 원시 응답 디버깅
    console.log(`[getTrafficByRoute] ITS params: ${JSON.stringify(params)}`);
    const res = await this.itsService.getRealtimeTrafficInfo(params);
    console.log(`[getTrafficByRoute] ITS raw response:`, JSON.stringify(res));
    // ITS API JSON/XML 응답 구조에 따라 유연하게 items 파싱
    const body = res?.response?.body ?? res?.body;
    const rawItems = body?.items?.item ?? body?.items ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    const filtered = items.filter(i => linkIdSet.has(i.linkId));

    return { totalCount: filtered.length, items: filtered };
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
} 