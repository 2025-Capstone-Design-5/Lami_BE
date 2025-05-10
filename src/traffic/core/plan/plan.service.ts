import { Injectable, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { OtpService } from '@/traffic/core/otp/otp.service';
import { MappingService } from '@/traffic/core/mapping/mapping.service';
import { RealtimeService } from '@/traffic/core/realtime/realtime.service';
import { OtpPlanResponse } from '@/traffic/core/otp/interfaces/otp.interfaces';
import { TmapService } from '@/traffic/core/tmap/tmap.service';

@Injectable()
export class PlanService {
  constructor(
    private readonly otpService: OtpService,
    private readonly mappingService: MappingService,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
    private readonly tmapService: TmapService,
  ) {}

  /**
   * 주소 기반 경로 탐색
   * - Tmap으로 주소→좌표 변환
   * - 변환된 좌표로 OTP 서버 호출
   */
  async planRoute(
    fromAddress: string,
    toAddress: string,
  ): Promise<OtpPlanResponse> {
    try {
      // 1) 주소 문자열 파싱 → city_do, gu_gun, dong으로 분리
      const fromAddr = this.parseAddress(fromAddress);
      const toAddr = this.parseAddress(toAddress);
      // 2) 주소 → 좌표 (geocoding)
      const fromGeoRes = await this.tmapService.geocode({
        city_do: fromAddr.city_do,
        gu_gun: fromAddr.gu_gun,
        dong: fromAddr.dong,
      });
      const toGeoRes = await this.tmapService.geocode({
        city_do: toAddr.city_do,
        gu_gun: toAddr.gu_gun,
        dong: toAddr.dong,
      });
      const fromGeo = fromGeoRes.coordinateInfo;
      const toGeo = toGeoRes.coordinateInfo;
      if (!fromGeo || !fromGeo.lat || !fromGeo.lon) {
        throw new HttpException('[PlanService.planRoute] 출발지 주소를 찾을 수 없습니다', HttpStatus.BAD_REQUEST);
      }
      if (!toGeo || !toGeo.lat || !toGeo.lon) {
        throw new HttpException('[PlanService.planRoute] 도착지 주소를 찾을 수 없습니다', HttpStatus.BAD_REQUEST);
      }
      const fromCoord = {
        lat: parseFloat(fromGeo.lat),
        lon: parseFloat(fromGeo.lon),
      };
      const toCoord = {
        lat: parseFloat(toGeo.lat),
        lon: parseFloat(toGeo.lon),
      };
      // 2) OTP에서 경로 계획 조회
      const planResponse = await this.otpService.plan(fromCoord, toCoord);
      // TODO: MappingService 및 RealtimeService 연동 로직 추가
      return planResponse;
    } catch (error) {
      // 상세 예외처리: 어떤 로직에서 오류 발생했는지 메시지에 포함
      if (error instanceof HttpException) {
        const resp = error.getResponse();
        let message: string;
        if (typeof resp === 'string') {
          message = resp;
        } else if (typeof resp === 'object' && 'message' in resp) {
          message = Array.isArray((resp as any).message)
            ? (resp as any).message.join(', ')
            : (resp as any).message;
        } else {
          message = JSON.stringify(resp);
        }
        // 중복 prefix 방지
        if (message.startsWith('[PlanService.planRoute]')) {
          throw new HttpException(message, error.getStatus());
        }
        throw new HttpException(`[PlanService.planRoute] ${message}`, error.getStatus());
      }
      const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
      throw new HttpException(`[PlanService.planRoute] 예기치 못한 오류: ${errMsg}`, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * 주소 문자열을 공백으로 분리하여 city_do, gu_gun, dong으로 반환
   */
  private parseAddress(address: string): { city_do: string; gu_gun?: string; dong: string } {
    const parts = address.trim().split(/\s+/);
    const city_do = parts[0] || '';
    const gu_gun = parts.length > 1 ? parts[1] : undefined;
    const dong = parts.length > 2 ? parts.slice(2).join(' ') : '';
    return { city_do, gu_gun, dong };
  }
}
