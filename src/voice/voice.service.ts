import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as fs from 'fs';

@Injectable()
export class VoiceService {
  private readonly whisperUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.whisperUrl = this.configService.get<string>('WHISPER_API_URL') ?? '';
    if (!this.whisperUrl) {
      throw new Error('WHISPER_API_URL 환경변수가 없습니다.');
    }
  }

  async transcribeVoice(filePath: string): Promise<string> {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      const response = await firstValueFrom(
        this.httpService.post(this.whisperUrl, form, {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
        }),
      );

      return response.data?.text ?? '';
    } catch (err) {
      console.error('Whisper 요청 실패:', err.message);
      throw new HttpException(
        'Whisper 서버 요청 실패',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
