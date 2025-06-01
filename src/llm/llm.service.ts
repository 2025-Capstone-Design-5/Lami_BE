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

    if (!this.apiUrl || !this.modelName) {
      throw new Error('LLM 환경 변수(apiUrl/modelName)가 설정되지 않았습니다.');
    }
  }

  /**
   * 단순히 알람 시간 (HH:mm)을 추출
   */
  async extractAlarmTime(prompt: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            model: this.modelName,
            prompt: prompt,
            stream: false,
          },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const raw = response.data?.response;
      const match = raw?.match(/\b\d{1,2}:\d{2}\b/);

      if (!match) {
        throw new Error('LLM 응답에서 시간을 추출할 수 없습니다.');
      }

      return match[0];
    } catch (error) {
      console.error('LLM 요청 실패:', error.message);
      throw new HttpException(
        'LLM 요청 실패',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 출발지, 도착지, 도착시간, 알람시간을 JSON으로 추출
   */
  async extractAlarmDetails(prompt: string): Promise<{
    departure: string;
    destination: string;
    arrival_time: string;
    wake_up_time: string;
  }> {
    const fullPrompt = `다음 문장에서 출발지, 도착지, 도착시간, 알람시간을 JSON 형식으로 추출해줘:\n"${prompt}"\nJSON 예시:\n{"departure": "...", "destination": "...", "arrival_time": "...", "wake_up_time": "..."}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            model: this.modelName,
            prompt: fullPrompt,
            stream: false,
          },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const raw = response.data?.response;

      try {
        const parsed = JSON.parse(raw);
        return parsed;
      } catch {
        console.error('LLM 응답 파싱 실패:', raw);
        throw new Error('LLM 응답을 JSON으로 파싱할 수 없습니다.');
      }
    } catch (error) {
      console.error('LLM 요청 실패:', error.message);
      throw new HttpException(
        'LLM 요청 실패',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
