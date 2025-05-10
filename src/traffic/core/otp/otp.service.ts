import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OtpPlanResponse } from './interfaces/otp.interfaces';

@Injectable()
export class OtpService {
  constructor(private readonly httpService: HttpService) {}

  async plan(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
  ): Promise<OtpPlanResponse> {
    const url = `${process.env.OTP_URL}/otp/routers/default/plan`;
    const response = await firstValueFrom(
      this.httpService.get<OtpPlanResponse>(url, {
        params: {
          fromPlace: `${from.lat},${from.lon}`,
          toPlace: `${to.lat},${to.lon}`,
          mode: 'TRANSIT,WALK',
        },
      }),
    );
    return response.data;
  }
}



