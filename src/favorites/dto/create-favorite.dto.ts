import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @IsString()
  name: string;

  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}
