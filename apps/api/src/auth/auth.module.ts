import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { FacilitiesModule } from '../facilities/facilities.module.js';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RolesGuard } from '../roles/roles.guard.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
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
    PermissionsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenBlacklistRepository,
    // Guard toàn cục chạy theo thứ tự khai báo: RolesGuard đọc request.user do JwtAuthGuard gắn,
    // PermissionsGuard (RBAC động) chạy sau kiểm tra vai trò tĩnh.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
