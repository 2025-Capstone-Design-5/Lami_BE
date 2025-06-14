import {
  Controller,
  Post,
  Body,
  HttpStatus,
  Get,
  Param,
  UseInterceptors,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedRoute } from './entities/saved-route.entity';
import { FavoriteRoute } from './entities/favorite-route.entity';
import { RoutesService } from './routes.service';
import { RouteRequestDto } from './dto/route-request.dto';
import {
  AllRoutesSummaryResponseDto,
  AllRoutesSummaryDataDto,
  RouteSummaryDto,
} from './dto/route-summary-response.dto';
import { plainToInstance } from 'class-transformer';
import {
  CACHE_MANAGER,
  CacheInterceptor,
  CacheKey,
  CacheTTL,
} from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RouteDetailRequestDto } from './dto/route-detail-request.dto';
import { RouteDetailResponseDto } from './dto/route-detail-response.dto';
import { RouteSaveRequestDto } from './dto/route-save-request.dto';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '@/users/users.service';
import { AlarmService } from '@/alarm/alarm.service';

@Controller('traffic/routes')
export class RoutesController {
  private readonly logger = new Logger(RoutesController.name);
  constructor(
    private readonly routesService: RoutesService,
    @InjectRepository(SavedRoute)
    private readonly savedRouteRepo: Repository<SavedRoute>,
    @InjectRepository(FavoriteRoute)
    private readonly favoritesRepo: Repository<FavoriteRoute>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly usersService: UsersService,
    private readonly alarmService: AlarmService,
  ) {}

  @Post()
  async getAllRoutes(
    @Body() dto: RouteRequestDto,
  ): Promise<AllRoutesSummaryResponseDto> {
    this.logger.log(`getAllRoutes request received: ${JSON.stringify(dto)}`);

    // 사용자 정보 확인 (옵셔널)
    let user: any = null;
    if (dto.googleId) {
      try {
        user = await this.usersService.findByGoogleId(dto.googleId);
      } catch {
        this.logger.warn(`User not found for googleId: ${dto.googleId}`);
      }
    }

    // 1) 모든 경로 raw 데이터 조회 (plan to arrive by specified time)
    const rawRoutes = await this.routesService.getAllRoutes(
      dto.fromAddress,
      dto.toAddress,
      {
        date: dto.date,
        time: dto.time,
        arriveBy: true,
      },
    );

    // 2) cache에 저장 (TTL 60초) - hash 기반 키
    const rawKey = `${dto.fromAddress}|${dto.toAddress}|${dto.date || ''}|${dto.time || ''}`;
    const hash = createHash('md5').update(rawKey).digest('hex');
    const uniqueSuffix = uuidv4();
    const cacheKey = `routes:${hash}:${uniqueSuffix}`;
    this.logger.log(
      `Caching rawRoutes with key: ${cacheKey}, rawKey: ${rawKey}`,
    );
    await this.cacheManager.set(cacheKey, rawRoutes, 500 * 1000);

    // 사용자 즐겨찾기 및 알람 정보 조회 (사용자가 있는 경우에만)
    let userFavorites: FavoriteRoute[] = [];
    let userAlarms: any[] = [];

    if (user && user.id) {
      userFavorites = await this.favoritesRepo.find({
        where: { userId: user.id },
      });
      userAlarms = await this.alarmService.getAlarms(user.id);
    }

    // 3) summary DTO 생성
    const summaryRoutes: RouteSummaryDto[] = [];
    Object.entries(rawRoutes).forEach(([category, routeList]) => {
      (routeList as any[]).forEach((route) => {
        const main = route.main;

        // 즐겨찾기 상태 확인
        const isFavorite = user
          ? userFavorites.some(
              (fav) =>
                fav.origin === dto.fromAddress &&
                fav.destination === dto.toAddress,
            )
          : false;

        // 알람 상태 확인 (간단히 해당 경로에 대한 알람이 있는지만 확인)
        const hasAlarm = user ? userAlarms.length > 0 : false;

        summaryRoutes.push({
          category,
          duration: main.duration,
          walkDurations: main.walkDurations,
          transitDurations: main.transitDurations,
          modes: main.modes,
          routeShortNames: main.routeShortNames,
          transferCount: main.transferCount,
          transfers: main.transfers,
          realtimeArrivalTimes: main.realtimeArrivalTimes,
          trafficItems: main.trafficItems,
          forecast: main.forecast,
          stops: main.stops,
          startvehicletime: main.startvehicletime,
          routetp: main.routetp,
          cityCode: main.cityCode,
          nodeId: main.nodeId,
          routeId: main.routeId,
          isFavorite,
          hasAlarm,
        });
      });
    });

    const responseData = plainToInstance(AllRoutesSummaryDataDto, {
      origin: dto.fromAddress,
      destination: dto.toAddress,
      summaryKey: cacheKey,
      routes: summaryRoutes,
    });
    return plainToInstance(AllRoutesSummaryResponseDto, {
      status: HttpStatus.OK,
      message: '경로 조회 성공',
      data: responseData,
    });
  }

  @Post('save')
  async saveRoute(
    @Body() dto: RouteSaveRequestDto,
  ): Promise<{ message: string; id: string }> {
    this.logger.log(`[RoutesController] saveRoute dto: ${JSON.stringify(dto)}`);
    try {
      // Find user by Google ID
      const user = await this.usersService.findByGoogleId(dto.googleId);
      if (!user) {
        throw new NotFoundException(
          `User with googleId ${dto.googleId} not found`,
        );
      }
      // Parse arrivalTime and save route
      const arrivalDate = new Date(dto.arrivalTime);
      const prepMinutes = dto.preparationTime ?? 0;
      const saved = await this.savedRouteRepo.save({
        userId: user.id,
        origin: dto.origin,
        destination: dto.destination,
        arrivalTime: arrivalDate,
        preparationTime: prepMinutes,
        options: dto.options,
        category: dto.category ?? 'general',
        route: {
          summary: dto.summary,
          detail: dto.detail,
          cityCode: dto.detail.cityCode?.toString(),
          routeId: dto.detail.routeId,
          nodeId: dto.detail.nodeId,
          linkIds: Array.isArray(dto.detail.trafficItems)
            ? dto.detail.trafficItems.map((item) => item.linkId || '')
            : [],
          sectionIds: [],
        },
      });
      this.logger.log(
        `[RoutesController] saveRoute successful: savedRouteId=${saved.id}`,
      );
      // Delegate wake-up time calculation to AlarmService
      await this.alarmService.registerAlarm(
        user.id,
        saved.arrivalTime.toISOString(),
        prepMinutes,
      );
      return { message: 'Route saved successfully', id: saved.id };
    } catch (error) {
      // Print full error to console for debugging
      console.error('[RoutesController] saveRoute error:', error);
      throw error;
    }
  }

  /**
   * 상세 경로 조회 (캐시 적용)
   */
  @Get(':routeId/details')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('route_details')
  @CacheTTL(30)
  async getRouteDetails(
    @Param('routeId') routeId: string,
  ): Promise<RouteDetailResponseDto> {
    // Fetch the stored route entity and return its detail JSON under 'data'
    const route = await this.routesService.getRouteDetailById(routeId);
    // route.detail contains the saved detail JSON (with main & sub)
    return plainToInstance(RouteDetailResponseDto, {
      status: HttpStatus.OK,
      message: '상세 경로 조회 성공',
      data: route.detail,
    });
  }

  /**
   * 클라이언트 요청에 따라 특정 경로의 상세 정보를 재계산해서 반환합니다.
   */
  @Post('detail')
  async getRouteDetailByRequest(
    @Body() dto: RouteDetailRequestDto,
  ): Promise<RouteDetailResponseDto> {
    this.logger.log(`Detail request received: ${JSON.stringify(dto)}`);
    const { summaryKey, category, index } = dto;
    // 캐시에서 rawRoutes 꺼내기 using summaryKey
    this.logger.log(`Looking up cache for summaryKey: ${summaryKey}`);
    const all = await this.cacheManager.get<Record<string, any[]>>(summaryKey);
    this.logger.log(`Cache lookup result: ${all ? 'HIT' : 'MISS'}`);
    if (!all) {
      this.logger.warn(`No cached routes for key: ${summaryKey}`);
      throw new BadRequestException(
        '캐시된 경로 정보가 없습니다. 먼저 요약 경로를 조회해주세요.',
      );
    }
    // 선택된 category에 해당하는 경로 리스트 조회
    const list = all[category];
    if (!list) {
      throw new BadRequestException(`Unknown category: "${category}"`);
    }
    const length = list.length;
    if (index < 0 || index >= length) {
      throw new BadRequestException(
        `Invalid index ${index} for category "${category}". Valid range: 0 to ${length - 1}`,
      );
    }
    const selected = list[index];
    // detail DTO로 래핑하여 반환
    return plainToInstance(RouteDetailResponseDto, {
      status: HttpStatus.OK,
      message: '상세 경로 조회 성공',
      data: selected,
    });
  }

  @Post('quick-action')
  async quickAction(
    @Body()
    dto: {
      googleId: string;
      origin: string;
      destination: string;
      arrivalTime: string;
      preparationTime?: number;
      category?: string;
      summary: Record<string, any>;
      detail: Record<string, any>;
      action: 'favorite' | 'alarm' | 'both';
    },
  ): Promise<{ message: string; favoriteId?: string; savedRouteId?: string }> {
    this.logger.log(
      `[RoutesController] quickAction dto: ${JSON.stringify(dto)}`,
    );

    try {
      const user = await this.usersService.findByGoogleId(dto.googleId);
      if (!user) {
        throw new NotFoundException(
          `User with googleId ${dto.googleId} not found`,
        );
      }

      const result: {
        message: string;
        favoriteId?: string;
        savedRouteId?: string;
      } = {
        message: '',
      };

      // 즐겨찾기 추가
      if (dto.action === 'favorite' || dto.action === 'both') {
        // 중복 확인
        const existingFavorite = await this.favoritesRepo.findOne({
          where: {
            userId: user.id,
            origin: dto.origin,
            destination: dto.destination,
          },
        });

        if (existingFavorite) {
          // 이미 존재하면 삭제 (토글)
          await this.favoritesRepo.remove(existingFavorite);
          result.message = '즐겨찾기에서 제거되었습니다.';
        } else {
          // 존재하지 않으면 추가
          const favorite = await this.favoritesRepo.save({
            userId: user.id,
            origin: dto.origin,
            destination: dto.destination,
            category: dto.category ?? 'general',
          });
          result.favoriteId = favorite.id;
          result.message = '즐겨찾기에 추가되었습니다.';
        }
      }

      // 알람 추가
      if (dto.action === 'alarm' || dto.action === 'both') {
        const arrivalDate = new Date(dto.arrivalTime);
        const prepMinutes = dto.preparationTime ?? 0;

        const saved = await this.savedRouteRepo.save({
          userId: user.id,
          origin: dto.origin,
          destination: dto.destination,
          arrivalTime: arrivalDate,
          preparationTime: prepMinutes,
          category: dto.category ?? 'general',
          route: {
            summary: dto.summary,
            detail: dto.detail,
            cityCode: dto.detail.cityCode?.toString(),
            routeId: dto.detail.routeId,
            nodeId: dto.detail.nodeId,
            linkIds: Array.isArray(dto.detail.trafficItems)
              ? dto.detail.trafficItems.map((item) => item.linkId || '')
              : [],
            sectionIds: [],
          },
        });

        await this.alarmService.registerAlarm(
          user.id,
          saved.arrivalTime.toISOString(),
          prepMinutes,
        );

        result.savedRouteId = saved.id;
      }

      // 메시지 설정
      if (dto.action === 'alarm') {
        result.message = '알람이 설정되었습니다.';
      } else if (dto.action === 'both') {
        result.message = '즐겨찾기 및 알람이 설정되었습니다.';
      }

      this.logger.log(
        `[RoutesController] quickAction successful: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      console.error('[RoutesController] quickAction error:', error);
      throw error;
    }
  }
}
