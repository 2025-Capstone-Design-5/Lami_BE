import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class CalendarService {
  private oAuth2Client: OAuth2Client;
  private clientId: string;
  private clientSecret: string;
  // Store refresh token for reuse (persisted in a DB)
  private refreshToken?: string;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI_CALENDAR;
    // Ensure client credentials exist
    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing Google OAuth client ID or secret in environment',
      );
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this.oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  // 인증 URL 생성 (optional state for user identification)
  getAuthUrl(state?: string): string {
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    });
    return authUrl;
  }

  // 인증 후 토큰 설정
  async getToken(code: string): Promise<any> {
    const { tokens } = await this.oAuth2Client.getToken(code);
    // Persist refresh token if provided
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token;
      // TODO: persist this.refreshToken to your database
    }
    this.oAuth2Client.setCredentials(tokens);
    return tokens;
  }

  // 구글 캘린더 이벤트 가져오기
  async getCalendarEvents(): Promise<any> {
    // Reattach stored refresh token if needed
    if (this.refreshToken && !this.oAuth2Client.credentials.refresh_token) {
      this.oAuth2Client.setCredentials({ refresh_token: this.refreshToken });
    }
    const calendarApi = google.calendar({
      version: 'v3',
      auth: this.oAuth2Client,
    });
    const res = await calendarApi.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items;
  }

  // 새 이벤트 생성
  async addEvent(params: {
    summary: string;
    start: Date;
    end: Date;
    description?: string;
    location?: string;
  }): Promise<any> {
    // Ensure tokens are set
    if (this.refreshToken && !this.oAuth2Client.credentials.refresh_token) {
      this.oAuth2Client.setCredentials({ refresh_token: this.refreshToken });
    }
    const calendarApi = google.calendar({
      version: 'v3',
      auth: this.oAuth2Client,
    });
    const event = {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: { dateTime: params.start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: params.end.toISOString(), timeZone: 'UTC' },
    };
    const response = await calendarApi.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all',
    });
    return response.data;
  }

  /** 외부에서 DB refresh_token을 주입 */
  public setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
    // @ts-ignore: passing client_id and client_secret for refresh request
    (this.oAuth2Client as any).setCredentials({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
  }
}
