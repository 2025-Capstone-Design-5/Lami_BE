import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ResponseDto } from '../../../common/dto/response.dto';
import { TransferDto } from './route-info.dto';

export class RouteSummaryDto {
  @IsString()
  category: string;

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
  modes: string[];

  @IsArray()
  @IsString({ each: true })
  routeShortNames: string[];

  @IsNumber()
  transferCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferDto)
  transfers: TransferDto[];

  @IsArray()
  @IsNumber({}, { each: true })
  realtimeArrivalTimes: number[];

  @IsArray()
  trafficItems: any[];

  @IsArray()
  forecast: any[];

  @IsArray()
  @IsString({ each: true })
  stops: string[];

  @IsString()
  startvehicletime?: string;

  @IsString()
  routetp?: string;

  @IsString()
  cityCode?: string;

  @IsString()
  nodeId?: string;

  @IsString()
  routeId?: string;
}

export class AllRoutesSummaryDataDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsString()
  summaryKey: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteSummaryDto)
  routes: RouteSummaryDto[];
}

export class AllRoutesSummaryResponseDto extends ResponseDto<AllRoutesSummaryDataDto> {
  @ValidateNested()
  @Type(() => AllRoutesSummaryDataDto)
  declare data: AllRoutesSummaryDataDto;
}
