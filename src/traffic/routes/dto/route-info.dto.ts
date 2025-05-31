import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 환승 정보 DTO
 */
export class TransferDto {
  @IsString()
  stationName: string;

  @IsString()
  fromRoute: string;

  @IsString()
  toRoute: string;

  @IsNumber()
  departureTime: number;

  @IsNumber()
  waitTime: number;
}

/**
 * 주요 경로 정보 DTO
 */
export class MainRouteDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsArray()
  @IsString({ each: true })
  stops: string[];

  @IsNumber()
  duration: number;

  @IsArray()
  @IsNumber({}, { each: true })
  walkDurations: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  transitDurations: number[];

  @IsArray()
  @IsString({ each: true })
  routeShortNames: string[];

  @IsArray()
  @IsString({ each: true })
  modes: string[];

  @IsNumber()
  transferCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferDto)
  transfers: TransferDto[];

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  realtimeArrivalTimes?: number[];

  @IsOptional()
  @IsArray()
  trafficItems?: any[];

  @IsOptional()
  @IsObject()
  forecast?: any;
}

/**
 * 서브 경로 정보 DTO
 */
export class SubRouteDto {
  @IsString()
  mode: string;

  @IsBoolean()
  @IsOptional()
  transitLeg?: boolean;

  @IsObject()
  from: any;

  @IsObject()
  to: any;

  @IsObject()
  legGeometry: any;

  @IsArray()
  steps: any[];
}

/**
 * 경로 DTO (main, sub)
 */
export class RouteDto {
  @IsObject()
  @ValidateNested()
  @Type(() => MainRouteDto)
  main: MainRouteDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubRouteDto)
  sub: SubRouteDto[];
}

/**
 * 전체 경로 응답 DTO
 */
export class RoutesResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  best: RouteDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => RouteDto)
  worst: RouteDto;
} 