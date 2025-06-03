import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ResponseDto } from '../../../common/dto/response.dto';
import { FlattenRouteDto } from './flattened-routes-response.dto';

export class AllRoutesDataDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlattenRouteDto)
  routes: FlattenRouteDto[];
}

export class AllRoutesResponseDto extends ResponseDto<AllRoutesDataDto> {
  @ValidateNested()
  @Type(() => AllRoutesDataDto)
  declare data: AllRoutesDataDto;
}
