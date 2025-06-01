import { IsNotEmpty, IsString } from 'class-validator';

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
}
