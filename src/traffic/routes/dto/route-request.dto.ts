import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

/**
 * 경로 검색 요청 DTO
 */
export class RouteRequestDto {
  /**
   * 출발지 주소
   * @example "서울특별시 강남구 삼성동"
   */
  @IsString()
  @IsNotEmpty()
  fromAddress: string;

  /**
   * 목적지 주소
   * @example "서울특별시 중구 명동"
   */
  @IsString()
  @IsNotEmpty()
  toAddress: string;

  /**
   * 출발 또는 도착 날짜 (YYYY-MM-DD)
   */
  @IsOptional()
  @IsString()
  date?: string;

  /**
   * 출발 또는 도착 시간 (HH:mm:ss)
   */
  @IsOptional()
  @IsString()
  time?: string;

  /**
   * 사용자 Google ID (즐겨찾기/알람 상태 확인용)
   */
  @IsOptional()
  @IsString()
  googleId?: string;
}
