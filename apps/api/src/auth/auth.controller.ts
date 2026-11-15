import { Body, Controller, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  CreateStaffResponseData,
  LoginResponseData,
  SignupResponseData,
} from '@drmayday/shared';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import type { VerifiedJwt } from './jwt-payload.js';
import { Public } from './public.decorator.js';

/** Sheet tab 1.1–1.6. */
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

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<Record<string, never>> {
    await this.auth.forgotPassword(dto);
    return {};
  }

  @ApiBearerAuth()
  @Put('change-password')
  async changePassword(
    @CurrentUser() user: VerifiedJwt,
    @Body() dto: ChangePasswordDto,
  ): Promise<Record<string, never>> {
    await this.auth.changePassword(user, dto);
    return {};
  }

  @ApiBearerAuth()
  @Post('admin/create-staff')
  @RequireRole('admin')
  @RequirePermission('manage_users')
  @ResponseCode('1001')
  createStaff(@Body() dto: CreateStaffDto): Promise<CreateStaffResponseData> {
    return this.auth.createStaff(dto);
  }
}
