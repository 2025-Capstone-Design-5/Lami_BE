import { IsString, IsNotEmpty } from 'class-validator';

export class PlanDto {
  /** 출발지 주소 */
  @IsString()
  @IsNotEmpty({ message: '출발지 주소를 입력해주세요.' })
  fromAddress: string;
  /** 도착지 주소 */
  @IsString()
  @IsNotEmpty({ message: '도착지 주소를 입력해주세요.' })
  toAddress: string;
}
