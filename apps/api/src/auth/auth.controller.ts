import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { LoginResponseData, SignupResponseData } from '@drmayday/shared';
import { ResponseCode } from '../common/response-code.decorator.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import type { VerifiedJwt } from './jwt-payload.js';
import { Public } from './public.decorator.js';

/** Sheet tab 1.1–1.3. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @ResponseCode('1001')
  signup(@Body() dto: SignupDto): Promise<SignupResponseData> {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponseData> {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  async logout(@CurrentUser() user: VerifiedJwt): Promise<Record<string, never>> {
    await this.auth.logout(user);
    return {};
  }
}
