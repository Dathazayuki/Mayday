import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@drmayday/shared';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from './config/env.js';

type LegacyRequest = Request & { isLegacyApi?: boolean };

/** Origin của Web khi chạy `pnpm dev:web` (apps/web/vite.config.ts, server.port). */
export const DEV_WEB_ORIGIN = 'http://localhost:5173';

type SetupEnv = Pick<Env, 'APP_ENV' | 'CORS_ORIGINS'>;

/** APP_ENV chưa đặt được coi như production (giống otp-sender): tắt tính năng chỉ dành cho dev. */
function isDevLike(env: SetupEnv): boolean {
  return env.APP_ENV === 'development' || env.APP_ENV === 'test';
}

/**
 * Origin được gọi API từ trình duyệt: CORS_ORIGINS nếu có; không thì development/test cho Web dev,
 * production không cho origin nào (Web chạy cùng origin hoặc phải đặt CORS_ORIGINS). App mobile gọi
 * API trực tiếp, không bị CORS chặn.
 */
export function corsOrigins(env: SetupEnv): string[] {
  if (env.CORS_ORIGINS) return env.CORS_ORIGINS;
  return isDevLike(env) ? [DEV_WEB_ORIGIN] : [];
}

/** Swagger chỉ mở ngoài production (APP_ENV development/test). */
export function isSwaggerEnabled(env: SetupEnv): boolean {
  return isDevLike(env);
}

/** Cấu hình dùng chung cho main.ts và e2e test. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const env: SetupEnv = {
    APP_ENV: config.get('APP_ENV', { infer: true }),
    CORS_ORIGINS: config.get('CORS_ORIGINS', { infer: true }),
  };
  const prefix = API_PREFIX.replace(/^\//, '');
  app.setGlobalPrefix(prefix);

  // Tương thích mayday-test: chuyển tiếp /api/* (không có /v1/) sang /api/v1/* và ánh xạ route legacy
  app.use((req: LegacyRequest, _res: Response, next: NextFunction) => {
    if (typeof req.url === 'string' && req.url.startsWith('/api/') && !req.url.startsWith('/api/v1/')) {
      req.isLegacyApi = true;
      req.url = req.url.replace(/^\/api\//, '/api/v1/');
      if (req.url === '/api/v1/auth/create-staff' || req.url.startsWith('/api/v1/auth/create-staff?')) {
        req.url = req.url.replace('/api/v1/auth/create-staff', '/api/v1/auth/admin/create-staff');
      } else if (
        req.method === 'POST' &&
        (req.url === '/api/v1/auth/change-password' || req.url.startsWith('/api/v1/auth/change-password?'))
      ) {
        req.method = 'PUT';
      } else if (
        req.method === 'DELETE' &&
        /^\/api\/v1\/role_permissions\/role\/[^/?]+\/permission\/[^/?]+/.test(req.url)
      ) {
        req.url = req.url.replace(
          /^\/api\/v1\/role_permissions\/role\/([^/?]+)\/permission\/([^/?]+)/,
          '/api/v1/role_permissions/$1/$2',
        );
      } else if (req.method === 'GET' && /^\/api\/v1\/medical_records\/patients\/[^/?]+(\?.*)?$/.test(req.url)) {
        req.url = req.url.replace(
          /^\/api\/v1\/medical_records\/patients\/([^/?]+)(\?.*)?$/,
          '/api/v1/medical_records/patients/$1/history$2',
        );
      }
    }
    next();
  });

  const origins = corsOrigins(env);
  if (origins.length > 0) app.enableCors({ origin: origins });

  if (!isSwaggerEnabled(env)) return;
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('DrMayDay API')
      .setDescription('Tài liệu chuẩn: docs/02-api/README.md')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${prefix}/docs`, app, document);
}
