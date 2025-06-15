import { Controller, Get, Query, Redirect, Post, Body } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { UsersService } from '@/users/users.service';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly usersService: UsersService,
  ) {}

  // 구글 인증 URL로 리다이렉트
  @Get('auth')
  @Redirect()
  getAuthUrl(@Query('googleId') googleId: string) {
    const authUrl = this.calendarService.getAuthUrl(googleId);
    return { url: authUrl };
  }

  // 인증 후 리다이렉트되는 콜백 처리
  @Get('oauth2callback')
  async oauth2callback(
    @Query('code') code: string,
    @Query('state') googleId: string,
  ) {
    const tokens = await this.calendarService.getToken(code);
    if (tokens.access_token && tokens.refresh_token) {
      await this.usersService.updateUserTokens(
        googleId,
        tokens.access_token,
        tokens.refresh_token,
        new Date(),
      );
    }
    return tokens;
  }

  // 구글 캘린더 이벤트 가져오기
  @Get('events')
  async getCalendarEvents() {
    const events = await this.calendarService.getCalendarEvents();
    return events;
  }

  // 새 구글 캘린더 이벤트 생성
  @Post('events')
  async addEvent(
    @Body()
    body: {
      summary: string;
      start: string; // ISO datetime
      end: string; // ISO datetime
      description?: string;
      location?: string;
    },
  ) {
    const event = await this.calendarService.addEvent({
      summary: body.summary,
      start: new Date(body.start),
      end: new Date(body.end),
      description: body.description,
      location: body.location,
    });
    return event;
  }
}
