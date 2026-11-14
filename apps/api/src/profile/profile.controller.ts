import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ProfileData } from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfileService } from './profile.service.js';

/** Sheet tab "GET /api/profile" và "PUT /api/profile": hồ sơ của người dùng đang đăng nhập. */
@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: VerifiedJwt): Promise<ProfileData> {
    return this.profile.get(Number(user.sub));
  }

  @Put()
  update(@CurrentUser() user: VerifiedJwt, @Body() dto: UpdateProfileDto): Promise<ProfileData> {
    return this.profile.update(Number(user.sub), dto);
  }
}
