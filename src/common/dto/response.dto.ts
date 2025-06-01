import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 공통 API 응답 DTO
 * @template D - data의 DTO 타입
 */
export class ResponseDto<D> {
  @IsNumber()
  status: number;

  @IsString()
  message: string;

  @ValidateNested()
  @Type((options) => {
    // Type은 서브클래스에서 재정의된 data 프로퍼티의 Type 데코레이터 정보를 사용합니다.
    return options?.newObject?.data?.constructor;
  })
  data: D;
}
