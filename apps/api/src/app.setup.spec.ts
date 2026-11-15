import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp, corsOrigins, DEV_WEB_ORIGIN, isSwaggerEnabled } from './app.setup.js';
import type { Env } from './config/env.js';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return 'pong';
  }
}

type SetupEnv = Pick<Env, 'APP_ENV' | 'CORS_ORIGINS'>;

async function createApp(env: SetupEnv): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    controllers: [PingController],
    providers: [{ provide: ConfigService, useValue: { get: (key: keyof SetupEnv) => env[key] } }],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('corsOrigins', () => {
  it.each(['development', 'test'] as const)(
    'APP_ENV=%s, chưa đặt CORS_ORIGINS → chỉ Web dev',
    (appEnv) => {
      expect(corsOrigins({ APP_ENV: appEnv })).toEqual([DEV_WEB_ORIGIN]);
    },
  );

  it('production hoặc APP_ENV chưa đặt, không có CORS_ORIGINS → không cho origin nào', () => {
    expect(corsOrigins({ APP_ENV: 'production' })).toEqual([]);
    expect(corsOrigins({})).toEqual([]);
  });

  it('có CORS_ORIGINS thì dùng đúng danh sách đó ở mọi môi trường', () => {
    const origins = ['https://web.example.vn', 'https://admin.example.vn'];
    expect(corsOrigins({ APP_ENV: 'production', CORS_ORIGINS: origins })).toEqual(origins);
    expect(corsOrigins({ APP_ENV: 'development', CORS_ORIGINS: origins })).toEqual(origins);
  });
});

describe('isSwaggerEnabled', () => {
  it('bật ở development/test, tắt ở production và khi APP_ENV chưa đặt', () => {
    expect(isSwaggerEnabled({ APP_ENV: 'development' })).toBe(true);
    expect(isSwaggerEnabled({ APP_ENV: 'test' })).toBe(true);
    expect(isSwaggerEnabled({ APP_ENV: 'production' })).toBe(false);
    expect(isSwaggerEnabled({})).toBe(false);
  });
});

describe('configureApp', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('development: có Swagger, cho phép Web dev gọi chéo origin, chặn origin lạ', async () => {
    app = await createApp({ APP_ENV: 'development' });
    await request(app.getHttpServer()).get('/api/v1/docs').expect(200);

    const allowed = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', DEV_WEB_ORIGIN)
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(DEV_WEB_ORIGIN);

    const other = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('production: không mount Swagger, không trả header CORS khi chưa đặt CORS_ORIGINS', async () => {
    app = await createApp({ APP_ENV: 'production' });
    await request(app.getHttpServer()).get('/api/v1/docs').expect(404);

    const res = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', DEV_WEB_ORIGIN)
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('production có CORS_ORIGINS: chỉ origin trong danh sách được trả header CORS', async () => {
    app = await createApp({ APP_ENV: 'production', CORS_ORIGINS: ['https://web.example.vn'] });

    const preflight = await request(app.getHttpServer())
      .options('/api/v1/ping')
      .set('Origin', 'https://web.example.vn')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('https://web.example.vn');

    const other = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', DEV_WEB_ORIGIN)
      .expect(200);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
