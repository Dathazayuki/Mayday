import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AdminUsersModule } from './admin-users/admin-users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/response.interceptor.js';
import { createValidationPipe } from './common/validation.js';
import { validateEnv } from './config/env.js';
import { FacilitiesModule } from './facilities/facilities.module.js';
import { HealthController } from './health/health.controller.js';
import { PatientsModule } from './patients/patients.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfileModule } from './profile/profile.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    FacilitiesModule,
    AdminUsersModule,
    PatientsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
