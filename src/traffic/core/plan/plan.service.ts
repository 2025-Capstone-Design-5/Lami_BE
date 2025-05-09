import { Injectable, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { OtpService } from '@/traffic/core/otp/otp.service';
import { MappingService } from '@/traffic/core/mapping/mapping.service';
import { RealtimeService } from '@/traffic/core/realtime/realtime.service';
import { OtpPlanResponse } from '@/traffic/core/otp/interfaces/otp.interfaces';

@Injectable()
export class PlanService {
  constructor(
    private readonly otpService: OtpService,
    private readonly mappingService: MappingService,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
  ) {}

  // TODO: OTP와 Tmap을 결합한 경로 탐색 로직 구현
  async planRoute(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
  ): Promise<OtpPlanResponse> {
    try {
      // 1) OTP에서 경로 계획 조회
      const planResponse = await this.otpService.plan(from, to);
      // TODO: GTFS 정류장 ID 추출 후 TAGO 노드 ID 매핑, realtimeService를 통한 ETA 조회 로직 구현
      return planResponse;
    } catch (error) {
      // 네트워크 또는 OTP 서버 연결 실패시 간단 메시지로 예외 처리
      throw new HttpException('OTP 서버 연결에 실패했습니다', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
