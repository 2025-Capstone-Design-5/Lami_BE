import {
  Controller,
  Get,
  Query,
  Res,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Buffer } from 'buffer';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('google/login')
  loginWithGoogle(@Res() res: Response) {
    const url = this.authService.getGoogleAuthUrl();
    this.logger.log(`Redirecting to Google auth URL: ${url}`);
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    this.logger.log(`Received Google callback with code: ${code}`);
    const tokens = await this.authService.getTokens(code);
    // Deep link to Flutter client with tokens payload
    const deepLink = `${process.env.CLIENT_REDIRECT_URI}?tokens=${encodeURIComponent(JSON.stringify(tokens))}`;
    this.logger.log(`Redirecting back to client via deep link: ${deepLink}`);
    return res.redirect(deepLink);
  }

  @Post('google/code')
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body()
    body: {
      code: string;
      codeVerifier: string;
      platform: 'android' | 'ios';
    },
  ) {
    const { code, codeVerifier, platform } = body;
    this.logger.log(`Google code exchange requested: platform=${platform}`);
    try {
      const tokens = await this.authService.exchangeCodeForTokens(
        code,
        codeVerifier,
        platform,
      );
      this.logger.log(
        `Tokens obtained for platform ${platform}: ${JSON.stringify(tokens, null, 2)}`,
      );
      // id_token 디코딩
      const idTokenString = tokens.id_token;
      const base64Url = idTokenString.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const idTokenPayload = JSON.parse(
        Buffer.from(base64 + padding, 'base64').toString('utf-8'),
      );
      const { sub: googleId, email, name } = idTokenPayload;
      const user = await this.usersService.findOrCreate({
        googleId,
        email,
        name,
        role: UserRole.GOOGLE,
      });
      await this.usersService.updateUserTokens(
        googleId,
        tokens.access_token,
        tokens.refresh_token,
        new Date(),
      );
      this.logger.log(
        `Google login successful for googleId=${googleId}, userId=${user.id}`,
      );
      return {
        message: 'Tokens obtained',
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          id_token: tokens.id_token,
          idToken: idTokenPayload,
        },
      };
    } catch (err) {
      this.logger.error(
        `Token exchange failed: ${JSON.stringify(err.response?.data || err.message)}`,
      );
      throw new HttpException('Token exchange failed', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /auth/guest - guest login as ROOT role
   */
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  async guestLogin() {
    this.logger.log('Guest login requested');
    const guestGoogleId = 'guest';
    const user = await this.usersService.findOrCreate({
      googleId: guestGoogleId,
      email: 'guest@localhost',
      name: 'Guest Root',
      role: UserRole.ROOT,
    });
    this.logger.log(`Guest login successful: userId=${user.id}`);
    return { message: 'Guest login successful', data: user };
  }
}
