import { IsString } from 'class-validator';

export class CreateFavoriteRouteDto {
  @IsString()
  googleId: string;

  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsString()
  category: string;

  @IsString()
  wakeUpTime: string;
}
