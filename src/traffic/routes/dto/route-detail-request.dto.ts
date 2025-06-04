import { IsString, IsNumber } from 'class-validator';

export class RouteDetailRequestDto {
  @IsString()
  summaryKey: string;

  @IsString()
  category: string;

  @IsNumber()
  index: number;
}
