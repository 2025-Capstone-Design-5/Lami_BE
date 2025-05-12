import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
constructor(private readonly authService: AuthService) {}

@Get('google/login')
loginWithGoogle(@Res() res: Response) {
const url = this.authService.getGoogleAuthUrl();
return res.redirect(url);
}

@Get('google/callback')
async googleCallback(@Query('code') code: string, @Res() res: Response) {
const tokens = await this.authService.getTokens(code);
return res.json({
message: 'Google 로그인 성공',
tokens,
});
}
}
