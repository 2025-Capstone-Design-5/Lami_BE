import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TmapService } from '../tmap/tmap.service';
import axios from 'axios';

@Controller('traffic/graphql')
export class GraphqlProxyController {
  private readonly logger = new Logger(GraphqlProxyController.name);
  private readonly baseUrl =
    process.env.OTP_BASE_URL || 'http://localhost:8080';

  constructor(
    private readonly httpService: HttpService,
    private readonly tmapService: TmapService,
  ) {}

  @Post('transmodel')
  async proxyTransmodel(
    @Body() body: { query: string; variables?: any },
  ): Promise<any> {
    let { query, variables = {} } = body;
    const vars = { ...variables };
    // Geocode single address for types like stopsByRadius
    if (vars.address && typeof vars.address === 'string') {
      const geo = await this.tmapService.geocode(vars.address);
      vars.lat = parseFloat(geo.coordinateInfo.lat);
      vars.lon = parseFloat(geo.coordinateInfo.lon);
      delete vars.address;
    }
    // Trip 쿼리일 때 fromAddress/toAddress를 Location 객체로 변환
    if (
      /\btrip\s*\(/.test(query) &&
      typeof vars.fromAddress === 'string' &&
      typeof vars.toAddress === 'string'
    ) {
      const fromGeo = await this.tmapService.geocode(vars.fromAddress);
      const toGeo = await this.tmapService.geocode(vars.toAddress);
      vars.from = {
        coordinates: {
          latitude: parseFloat(fromGeo.coordinateInfo.lat),
          longitude: parseFloat(fromGeo.coordinateInfo.lon),
        },
      };
      vars.to = {
        coordinates: {
          latitude: parseFloat(toGeo.coordinateInfo.lat),
          longitude: parseFloat(toGeo.coordinateInfo.lon),
        },
      };
      delete vars.fromAddress;
      delete vars.toAddress;
      // GraphQL query에서 변수 이름 및 필드명을 fromAddress/toAddress → from/to 로 치환
      query = query
        .replace(/\$fromAddress/g, '$from')
        .replace(/\$toAddress/g, '$to')
        .replace(/\$from:String!/g, '$from:Location!')
        .replace(/\$to:String!/g, '$to:Location!')
        .replace(/fromAddress\s*:/g, 'from:')
        .replace(/toAddress\s*:/g, 'to:');
    }
    // Geocode from/to addresses for plan queries
    if (vars.fromAddress && vars.toAddress) {
      const fromGeo = await this.tmapService.geocode(vars.fromAddress);
      const toGeo = await this.tmapService.geocode(vars.toAddress);
      vars.fromLat = parseFloat(fromGeo.coordinateInfo.lat);
      vars.fromLon = parseFloat(fromGeo.coordinateInfo.lon);
      vars.toLat = parseFloat(toGeo.coordinateInfo.lat);
      vars.toLon = parseFloat(toGeo.coordinateInfo.lon);
      delete vars.fromAddress;
      delete vars.toAddress;
    }
    // Plan 쿼리인지 확인 (planConnection 또는 plan)
    const isPlanConnection = /\bplanConnection\s*\(/.test(query);
    const isPlan = /\bplan\s*\(/.test(query);
    const isPlanQuery = isPlanConnection || isPlan;
    if (isPlanQuery) {
      // 통합 GraphQL 엔드포인트로 계획 조회 전달
      this.logger.log(
        `Plan→Unified GraphQL ${this.baseUrl}/otp/routers/default/index/graphql, vars: ${JSON.stringify(vars)}`,
      );
      const planRes = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/otp/routers/default/index/graphql`,
          { query, variables: vars },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      if (planRes.data.errors)
        throw new BadRequestException(planRes.data.errors);
      return planRes.data;
    }
    if (Array.isArray(vars.viaAddress)) {
      vars.via = await Promise.all(
        vars.viaAddress.map(async (addr) => {
          const geo = await this.tmapService.geocode(addr);
          return {
            visit: {
              coordinate: {
                latitude: +geo.coordinateInfo.lat,
                longitude: +geo.coordinateInfo.lon,
              },
            },
          };
        }),
      );
      delete vars.viaAddress;
      // 쿼리 내 변수명 치환 ($viaAddress → $via, viaAddress: → via:)
      query = query
        .replace(/\$viaAddress/g, '$via')
        .replace(/viaAddress\s*:/g, 'via:');
    }
    this.logger.log(
      `GraphQL Transmodel → ${this.baseUrl}/otp/routers/default/transmodel/index/graphql, vars: ${JSON.stringify(vars)}`,
    );
    const res = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/otp/routers/default/transmodel/index/graphql`,
        { query, variables: vars },
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    if (res.data.errors) throw new BadRequestException(res.data.errors);
    return res.data;
  }

  @Post('gtfs')
  async proxyGtfs(
    @Body() body: { query: string; variables?: any },
  ): Promise<any> {
    let { query, variables = {} } = body;
    const vars = { ...variables };
    // Geocode single address for static GTFS queries
    if (vars.address && typeof vars.address === 'string') {
      const geo = await this.tmapService.geocode(vars.address);
      vars.lat = parseFloat(geo.coordinateInfo.lat);
      vars.lon = parseFloat(geo.coordinateInfo.lon);
      delete vars.address;
    }
    // Geocode from/to addresses for plan queries
    if (vars.fromAddress && vars.toAddress) {
      const fromGeo = await this.tmapService.geocode(vars.fromAddress);
      const toGeo = await this.tmapService.geocode(vars.toAddress);
      const fromCoord = {
        latitude: parseFloat(fromGeo.coordinateInfo.lat),
        longitude: parseFloat(fromGeo.coordinateInfo.lon),
      };
      const toCoord = {
        latitude: parseFloat(toGeo.coordinateInfo.lat),
        longitude: parseFloat(toGeo.coordinateInfo.lon),
      };
      // supply nested coordinate variables for plan queries
      vars.fromCoord = fromCoord;
      vars.toCoord = toCoord;
      // for backward compatibility
      vars.fromLat = fromCoord.latitude;
      vars.fromLon = fromCoord.longitude;
      vars.toLat = toCoord.latitude;
      vars.toLon = toCoord.longitude;
      delete vars.fromAddress;
      delete vars.toAddress;
    }
    // Plan 쿼리인지 확인 (planConnection 또는 plan)
    const isPlanConnection = /\bplanConnection\s*\(/.test(query);
    const isPlan = /\bplan\s*\(/.test(query);
    const isPlanQuery = isPlanConnection || isPlan;
    if (isPlanQuery) {
      // 1) Transmodel GraphQL로 계획 조회
      this.logger.log(
        `Plan→Transmodel ${this.baseUrl}/otp/routers/default/index/graphql, vars: ${JSON.stringify(vars)}`,
      );
      const tmRes = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/otp/routers/default/index/graphql`,
          { query, variables: vars },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      if (tmRes.data.errors) throw new BadRequestException(tmRes.data.errors);
      // GraphQL 응답에서 planConnection 또는 plan 필드 추출
      const planData = tmRes.data.data.planConnection ?? tmRes.data.data.plan;
      // 2) Static GTFS route 정보 조회
      const routeIds = new Set<string>();
      planData.itineraries.forEach((itin) =>
        itin.legs.forEach((leg) => leg.line?.id && routeIds.add(leg.line.id)),
      );
      const routeQuery = `
        query GetRoutes($feedIndex:Int!,$routeIds:[String!]!){
          routes(feedIndex:$feedIndex,routeId:$routeIds){
            id shortName longName color
          }
        }`;
      const routeVars = { feedIndex: 0, routeIds: Array.from(routeIds) };
      this.logger.log(
        `Fetching static routes→GTFS ${this.baseUrl}/otp/routers/default/index/graphql, vars: ${JSON.stringify(routeVars)}`,
      );
      const routesRes = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/otp/routers/default/index/graphql`,
          { query: routeQuery, variables: routeVars },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      if (routesRes.data.errors)
        throw new BadRequestException(routesRes.data.errors);
      const staticMap: Record<string, any> = {};
      routesRes.data.data.routes.forEach((r: any) => (staticMap[r.id] = r));
      // 3) 계획 데이터에 static 정보 병합
      planData.itineraries.forEach((itin) =>
        itin.legs.forEach((leg) => {
          const stat = staticMap[leg.line.id];
          if (stat) {
            leg.line.publicCode = stat.shortName || stat.id;
            leg.line.name = stat.longName || '';
            leg.line.presentation = { colour: stat.color };
          }
        }),
      );
      // 요청한 root 필드 이름으로 반환
      if (tmRes.data.data.planConnection) {
        return { data: { planConnection: planData } };
      } else {
        return { data: { plan: planData } };
      }
    }
    // RouteSegment 쿼리 처리
    const isRouteSegment =
      /\brouteSegment\s*\(/.test(query) &&
      typeof vars.id === 'string' &&
      typeof vars.fromStopId === 'string' &&
      typeof vars.toStopId === 'string';
    if (isRouteSegment) {
      const { id, headsign, fromStopId, toStopId } = vars;
      const fullRouteQuery = `
        query RoutePatterns($id:String!){
          route(id:$id){
            patterns{
              headsign
              stops{
                gtfsId
                name
                lat
                lon
              }
            }
          }
        }`;
      const fullRes = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/otp/gtfs/v1`,
          { query: fullRouteQuery, variables: { id } },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      if (fullRes.data.errors)
        throw new BadRequestException(fullRes.data.errors);
      const patterns = fullRes.data.data.route.patterns;
      let pattern;
      if (headsign) {
        pattern = patterns.find((p: any) => p.headsign === headsign);
      } else {
        pattern =
          patterns.find(
            (p: any) =>
              p.stops.some((s: any) => s.gtfsId === fromStopId) &&
              p.stops.some((s: any) => s.gtfsId === toStopId),
          ) ?? patterns[0];
      }
      if (!pattern) throw new BadRequestException('Pattern not found');
      const stops = pattern.stops;
      const startIndex = stops.findIndex((s: any) => s.gtfsId === fromStopId);
      const endIndex = stops.findIndex((s: any) => s.gtfsId === toStopId);
      if (startIndex < 0 || endIndex < 0)
        throw new BadRequestException('Stop not found');
      const segment =
        startIndex <= endIndex
          ? stops.slice(startIndex, endIndex + 1)
          : stops.slice(endIndex, startIndex + 1).reverse();
      return { data: { routeSegment: segment } };
    }
    // Static GTFS 전용 쿼리
    this.logger.log(
      `Static GTFS→GraphQL ${this.baseUrl}/otp/gtfs/v1, vars: ${JSON.stringify(vars)}`,
    );
    const res = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/otp/gtfs/v1`,
        { query, variables: vars },
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    if (res.data.errors) throw new BadRequestException(res.data.errors);
    return res.data;
  }

  // QuickTrip endpoint: 주소만으로 요약 정보 반환
  @Post('quick')
  async quickTrip(
    @Body() body: { fromAddress: string; toAddress: string; dateTime: string },
  ): Promise<any> {
    const { fromAddress, toAddress, dateTime } = body;
    // 1) 주소 → 좌표 변환
    const fromGeo = await this.tmapService.geocode(fromAddress);
    const toGeo = await this.tmapService.geocode(toAddress);
    const origin = {
      location: {
        coordinate: {
          latitude: parseFloat(fromGeo.coordinateInfo.lat),
          longitude: parseFloat(fromGeo.coordinateInfo.lon),
        },
      },
    };
    const destination = {
      location: {
        coordinate: {
          latitude: parseFloat(toGeo.coordinateInfo.lat),
          longitude: parseFloat(toGeo.coordinateInfo.lon),
        },
      },
    };
    // 2) GraphQL planConnection 호출 (OTP Unified endpoint)
    const planConnQuery = `
      query QuickPlanConn(
        $origin: PlanLabeledLocationInput!,
        $destination: PlanLabeledLocationInput!,
        $dateTime: PlanDateTimeInput!,
        $modes: PlanModesInput
      ){
        planConnection(
          origin: $origin,
          destination: $destination,
          dateTime: $dateTime,
          modes: $modes
        ){
          edges {
            node {
              duration
              walkTime
              legs {
                mode
                from{ stop{ gtfsId name } }
                to{   stop{ gtfsId name } }
                route{ id shortName }
              }
            }
          }
        }
      }`;
    const planResp = await axios.post(
      `${this.baseUrl}/otp/routers/default/index/graphql`,
      {
        query: planConnQuery,
        variables: {
          origin,
          destination,
          dateTime: { earliestDeparture: dateTime },
          modes: { transitOnly: true },
        },
      },
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (planResp.data.errors)
      throw new BadRequestException(planResp.data.errors);
    const planData = planResp.data.data.planConnection;
    const nodes = planData.edges.map((e: any) => e.node);
    const itinerary = nodes[0];
    // 3) 각 버스 구간 정류장 리스트 조회 (OTP GTFS endpoint)
    const segmentQuery = `
      query RouteSegment($id:String!,$fromStopId:String!,$toStopId:String!){
        routeSegment(id:$id,fromStopId:$fromStopId,toStopId:$toStopId){ gtfsId name lat lon }
      }`;
    const summary: any = {
      duration: itinerary.duration,
      transitTime: itinerary.duration - itinerary.walkTime,
      segments: [],
    };
    for (const leg of itinerary.legs) {
      if (leg.mode !== 'WALK') {
        // global Node ID -> feed-scoped ID (e.g. "1:ROUTE_ID")
        const decoded = Buffer.from(leg.route.id, 'base64').toString('utf8');
        const localId = decoded.split(':').slice(1).join(':');
        const segResp = await axios.post(
          'http://localhost:3000/traffic/graphql/gtfs',
          {
            query: segmentQuery,
            variables: {
              id: localId,
              fromStopId: leg.from.stop.gtfsId,
              toStopId: leg.to.stop.gtfsId,
            },
          },
          { headers: { 'Content-Type': 'application/json' } },
        );
        if (segResp.data.errors)
          throw new BadRequestException(segResp.data.errors);
        summary.segments.push({
          bus: leg.route.shortName,
          stops: segResp.data.data.routeSegment,
        });
      }
    }
    return summary;
  }
}
