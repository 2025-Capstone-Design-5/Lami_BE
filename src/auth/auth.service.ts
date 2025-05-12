import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

@Injectable()
export class AuthService {
  private oAuth2Client: OAuth2Client;

  constructor() {
    const clientId = 'YOUR_CLIENT_ID'; // Google OAuth2 클라이언트 ID
    const clientSecret = 'YOUR_CLIENT_SECRET'; // Google OAuth2 클라이언트 Secret
    const redirectUri = 'http://localhost:3000/auth/google/callback'; // 인증 후 리다이렉트 URI

    this.oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  // 구글 인증 URL 생성
  getGoogleAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/userinfo.profile'];
    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
    return authUrl;
  }

  // 인증 코드로 토큰 받기
  async getTokens(code: string): Promise<any> {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.oAuth2Client.setCredentials(tokens);
    return tokens;
  }

  // 구글 사용자 정보 가져오기
  async getUserInfo(): Promise<any> {
    const oauth2 = google.oauth2({
      version: 'v2',
      auth: this.oAuth2Client,
    });
    const userInfo = await oauth2.userinfo.get();
    return userInfo.data;
  }
}
