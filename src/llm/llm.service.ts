import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LlmService {
  private readonly apiUrl: string;
  private readonly modelName: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('LLM_API_URL') ?? '';
    this.modelName = this.configService.get<string>('LLM_MODEL_NAME') ?? '';
    
    // 환경 변수 체크
    if (!this.apiUrl || !this.modelName) {
       throw new Error('LLM 환경 변수(apiUrl/modelName)가 설정되지 않았습니다.');
    }
  }

  async extractAlarmTime(prompt: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.apiUrl, {
          model: this.modelName,
          prompt: prompt,
        }, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const raw = response.data?.response;
      const match = raw?.match(/\b\d{1,2}:\d{2}\b/);

      if (!match) {
        throw new Error('LLM 응답에서 시간을 추출할 수 없습니다.');
      }

      return match[0];
    } catch (error) {
      console.error('LLM 요청 실패:', error.message);
      throw new HttpException('LLM 요청 실패', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
