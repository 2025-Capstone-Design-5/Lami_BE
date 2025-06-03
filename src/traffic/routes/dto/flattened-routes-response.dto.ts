import { IsString, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteDto } from './route-info.dto';

export class FlattenRouteDto {
  @IsString()
  category: string;

  @IsObject()
  @ValidateNested()
  @Type(() => RouteDto)
  route: RouteDto;
}

export class FlattenRoutesResponseDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlattenRouteDto)
  routes: FlattenRouteDto[];
} 