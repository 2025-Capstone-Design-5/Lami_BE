import { Controller, Get, Query, Redirect } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // 구글 인증 URL로 리다이렉트
  @Get('auth')
  @Redirect()
  getAuthUrl() {
    const authUrl = this.calendarService.getAuthUrl();
    return { url: authUrl };
  }

  // 인증 후 리다이렉트되는 콜백 처리
  @Get('oauth2callback')
  async oauth2callback(@Query('code') code: string) {
    const tokens = await this.calendarService.getToken(code);
    return tokens; // 토큰 정보를 반환하거나 세션에 저장
  }

  // 구글 캘린더 이벤트 가져오기
  @Get('events')
  async getCalendarEvents() {
    const events = await this.calendarService.getCalendarEvents();
    return events;
  }
}
