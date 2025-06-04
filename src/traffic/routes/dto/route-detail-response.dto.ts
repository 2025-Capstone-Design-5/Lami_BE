import { ResponseDto } from '../../../common/dto/response.dto';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteDto } from './route-info.dto';

export class RouteDetailResponseDto extends ResponseDto<RouteDto> {
  @ValidateNested()
  @Type(() => RouteDto)
  declare data: RouteDto;
}
