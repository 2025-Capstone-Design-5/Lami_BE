import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { google } from 'googleapis';

@Controller('auth')
export class AuthController {
  private oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  @Get('google/login')
  loginWithGoogle(@Res() res: Response) {
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent',
    });

    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // TODO: 이 토큰을 DB에 저장하거나, 세션 처리 등 수행
      console.log('Google Tokens:', tokens);

      return res.json({
        message: 'Google 로그인 성공',
        tokens,
      });
    } catch (error) {
      console.error('구글 인증 실패:', error);
      return res.status(500).send('구글 인증 실패');
    }
  }
}
