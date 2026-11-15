import { MODULE_METADATA } from '@nestjs/common/constants.js';
import type { ClassProvider, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { RolesGuard } from '../roles/roles.guard.js';
import { AuthModule } from './auth.module.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('AuthModule', () => {
  it('guard toàn cục chạy theo thứ tự khai báo: JWT → vai trò tĩnh → RBAC động', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as Provider[];
    const guards = providers
      .filter(
        (provider): provider is ClassProvider =>
          typeof provider === 'object' && 'provide' in provider && provider.provide === APP_GUARD,
      )
      .map((provider) => provider.useClass);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard, PermissionsGuard]);
  });
});
