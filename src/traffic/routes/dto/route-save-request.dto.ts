import { IsString, IsNumber, IsObject, IsOptional } from 'class-validator';

export class RouteSaveRequestDto {
  @IsString()
  googleId: string;

  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsString()
  arrivalTime: string;

  @IsNumber()
  @IsOptional()
  preparationTime?: number;

  @IsObject()
  @IsOptional()
  options?: Record<string, any>;

  @IsString()
  @IsOptional()
  category?: string;

  @IsObject()
  summary: Record<string, any>;

  @IsObject()
  detail: Record<string, any>;
}
