import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { FacilitiesModule } from '../facilities/facilities.module.js';
import { RolesGuard } from '../roles/roles.guard.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { DevLogOtpSender, OTP_SENDER } from './otp-sender.js';
import { PasswordService } from './password.service.js';
import { TokenBlacklistRepository } from './token-blacklist.repository.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) },
      }),
    }),
    UsersModule,
    RolesModule,
    FacilitiesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenBlacklistRepository,
    // Chưa có kênh gửi OTP thật (MT-16): bản dev ghi log, production trả 9903.
    { provide: OTP_SENDER, useClass: DevLogOtpSender },
    // Guard toàn cục chạy theo thứ tự khai báo: RolesGuard đọc request.user do JwtAuthGuard gắn.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}
