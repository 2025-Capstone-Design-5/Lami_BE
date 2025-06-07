import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VoiceService } from './voice.service';

@Controller('voice')
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(private readonly voiceService: VoiceService) {}

  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = 'voice-' + Date.now() + extname(file.originalname);
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      this.logger.warn('파일이 업로드되지 않았습니다.');
      throw new HttpException('파일이 업로드되지 않았습니다.', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`업로드된 파일 경로: ${file.path}`);
      const text = await this.voiceService.transcribeVoice(file.path);
      return { success: true, text };
    } catch (error) {
      this.logger.error(`음성 변환 실패: ${error.message}`, error.stack);
      throw new HttpException('음성 파일 처리 중 오류가 발생했습니다.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
