import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
