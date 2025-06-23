import { IsNotEmpty, IsString } from 'class-validator';
import { IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ModesInput for GraphQL plan (street & transit modes)
 */
export class ModesInputDto {
  @IsArray()
  @IsString({ each: true })
  streetModes: string[];

  @IsArray()
  @IsString({ each: true })
  transitModes: string[];
}

/**
 * DTO for OTP GraphQL plan query by address with extended options
 */
export class GraphqlPlanRequestDto {
  /** 출발지 주소 */
  @IsString()
  @IsNotEmpty()
  fromAddress: string;

  /** 목적지 주소 */
  @IsString()
  @IsNotEmpty()
  toAddress: string;

  /** 여정 날짜 (YYYY-MM-DD) */
  @IsString()
  @IsNotEmpty()
  date: string;

  /** 여정 시간 (HH:mm) */
  @IsString()
  @IsNotEmpty()
  time: string;

  /**
   * 모드 설정: streetModes, transitModes
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ModesInputDto)
  modes?: ModesInputDto;

  /** 최대 도보 거리 (미터) */
  @IsOptional()
  @IsNumber()
  maxWalkDistance?: number;

  /** 최대 사전 환승 대기 시간 (초) */
  @IsOptional()
  @IsNumber()
  maxPreTransitTime?: number;

  /** 최대 환승 횟수 */
  @IsOptional()
  @IsNumber()
  maximumTransfers?: number;

  /** 조회할 여정 개수 */
  @IsOptional()
  @IsNumber()
  numItineraries?: number;

  /** 도보 계수 (기본 2.0) */
  @IsOptional()
  @IsNumber()
  walkReluctance?: number;

  /** 대기 계수 (기본 1.0) */
  @IsOptional()
  @IsNumber()
  waitReluctance?: number;

  /** 환승 패널티 (초, 기본 180) */
  @IsOptional()
  @IsNumber()
  transferPenalty?: number;

  /** 환승 슬랙 (초, 기본 120) */
  @IsOptional()
  @IsNumber()
  transferSlack?: number;
}
