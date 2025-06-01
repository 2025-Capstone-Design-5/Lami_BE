import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ResponseDto } from '../../../common/dto/response.dto';
import { RouteDto } from './route-info.dto';

export class AllRoutesDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  walk: RouteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  car: RouteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  subway: RouteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  bus: RouteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  bus_subway: RouteDto[];
}

export class AllRoutesResponseDto extends ResponseDto<AllRoutesDataDto> {
  @ValidateNested()
  @Type(() => AllRoutesDataDto)
  declare data: AllRoutesDataDto;
}
