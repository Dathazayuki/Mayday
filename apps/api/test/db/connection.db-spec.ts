import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { Env } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/** Mất kết nối CSDL (spec A, mục 9.2): client trỏ tới 127.0.0.1:1. */
describe('CSDL không kết nối được (PostgreSQL)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const config = {
      get: (key: keyof Env) =>
        key === 'DATABASE_URL' ? 'postgresql://drmayday:sai@127.0.0.1:1/drmayday_test' : undefined,
    } as unknown as ConfigService<Env, true>;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(new PrismaService(config))
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health → db: down', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'down' } });
  });

  it('route có bảo vệ với token hợp lệ → 500 / 9902', async () => {
    const token = await app
      .get(JwtService)
      .signAsync({ sub: '1', role_id: '1', jti: 'jti-mat-ket-noi' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(500);
    expect(res.body).toEqual({ code: '9902', message: 'Database connection error' });
  });

  it('route công khai cần CSDL (đăng nhập) → 500 / 9902', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '0912345678', password: 'matkhau123' })
      .expect(500);
    expect(res.body.code).toBe('9902');
  });
});
