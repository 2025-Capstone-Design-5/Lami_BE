import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import axios from 'axios';
import * as qs from 'qs';

@Injectable()
export class AuthService {
  private oAuth2Client: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI_AUTH;

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

  /** Authorization Code 교환 및 토큰 교환 (PKCE) - Android/iOS 플랫폼 구분 */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    platform: 'android' | 'ios',
  ): Promise<any> {
    // 환경변수에서 플랫폼별 클라이언트 설정
    const clientId =
      platform === 'android'
        ? process.env.GOOGLE_CLIENT_ID_ANDROID
        : process.env.GOOGLE_CLIENT_ID_IOS;
    const clientSecret =
      platform === 'android'
        ? process.env.GOOGLE_CLIENT_SECRET_ANDROID
        : process.env.GOOGLE_CLIENT_SECRET_IOS;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI_AUTH!;

    // PKCE public client: client_secret이 있으면 포함
    const params: Record<string, string> = {
      code,
      client_id: clientId!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    };
    if (clientSecret) {
      params.client_secret = clientSecret;
    }
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      qs.stringify(params),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const tokens = response.data;
    // OAuth2Client에 credentials 설정 (기존 클라이언트 사용)
    this.oAuth2Client.setCredentials(tokens);
    return tokens;
  }

  /** 리프레시 토큰으로 액세스 토큰 갱신 */
  async refreshAccessToken(refreshToken: string): Promise<any> {
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      qs.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const tokens = response.data;
    this.oAuth2Client.setCredentials(tokens);
    // TODO: access_token 갱신 로직 (DB)
    return tokens;
  }
}
