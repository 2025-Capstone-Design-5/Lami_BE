import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class CalendarService {
  private oAuth2Client: OAuth2Client;
  
  constructor() {
    const clientId = 'YOUR_CLIENT_ID';
    const clientSecret = 'YOUR_CLIENT_SECRET';
    const redirectUri = 'http://localhost:3000/calendar/oauth2callback';
    
    this.oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  // 인증 URL 생성
  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
    return authUrl;
  }

  // 인증 후 토큰 설정
  async getToken(code: string): Promise<any> {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.oAuth2Client.setCredentials(tokens);
    return tokens;
  }

  // 구글 캘린더 이벤트 가져오기
  async getCalendarEvents(): Promise<any> {
    const calendar = google.calendar({ version: 'v3', auth: this.oAuth2Client });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items;
  }
}
