import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

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
   * true인 경우 date/time에 맞춰 도착하도록 안내합니다.
   */
  @IsOptional()
  @IsBoolean()
  arriveBy?: boolean;
}
