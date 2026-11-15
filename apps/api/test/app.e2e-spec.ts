import { Body, Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Public } from '../src/auth/public.decorator.js';
import { IsVietnamPhone } from '../src/common/is-vietnam-phone.decorator.js';
import { ResponseCode } from '../src/common/response-code.decorator.js';

class SampleDto {
  @IsString()
  name: string;

  @IsVietnamPhone()
  phone: string;
}

/** Controller chỉ dùng trong e2e để kiểm tra nền tảng (bảo vệ JWT, validation, mã 1001). */
@Controller('e2e-sample')
class SampleController {
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }

  @Public()
  @Post()
  @ResponseCode('1001')
  create(@Body() body: SampleDto) {
    return body;
  }

  @Public()
  @Post('action')
  action() {
    return { done: true };
  }
}

describe('Nền tảng API (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const payload = { sub: '1', role_id: '1', jti: 'e2e' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SampleController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health → 1000, db not_configured', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      code: '1000',
      message: 'OK',
      data: { status: 'ok', db: 'not_configured' },
    });
  });

  it('route không tồn tại → 404 / 2003 (MT-58)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/khong-ton-tai').expect(404);
    expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
  });

  it.each(['/api/v1/templates/all', '/api/v1/templates/TMPL_A'])(
    'API mẫu phiếu đã gỡ (spec A, mục 7.1): GET %s → 404 / 2003',
    async (path) => {
      const token = await jwt.signAsync(payload);
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    },
  );

  it('body JSON hỏng → 400 / 2007', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body).toEqual({ code: '2007', message: 'Request body invalid' });
  });

  it('thiếu trường bắt buộc → 400 / 2001', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .send({ phone: '0912345678' })
      .expect(400);
    expect(res.body).toEqual({
      code: '2001',
      message: 'Missing required parameter',
      data: { field: 'name' },
    });
  });

  it('sai số điện thoại → 400 / 2004', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .send({ name: 'An', phone: '12345' })
      .expect(400);
    expect(res.body).toMatchObject({ code: '2004', message: 'Invalid phone number format' });
  });

  it('tạo mới hợp lệ → 201 / 1001', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .send({ name: 'An', phone: '0912345678' })
      .expect(201);
    expect(res.body).toEqual({
      code: '1001',
      message: 'Created successfully',
      data: { name: 'An', phone: '0912345678' },
    });
  });

  it('POST không gắn @ResponseCode → 200 / 1000', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/e2e-sample/action').expect(200);
    expect(res.body).toEqual({ code: '1000', message: 'OK', data: { done: true } });
  });

  it('route cần đăng nhập, thiếu token → 401 / 3003', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/e2e-sample/protected').expect(401);
    expect(res.body).toEqual({ code: '3003', message: 'User not authenticated' });
  });

  it('token sai → 401 / 3001', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e-sample/protected')
      .set('Authorization', 'Bearer khong-phai-jwt')
      .expect(401);
    expect(res.body).toEqual({ code: '3001', message: 'Token is invalid' });
  });

  it('token hết hạn → 401 / 3002', async () => {
    const token = await jwt.signAsync(payload, { expiresIn: -10 });
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e-sample/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(res.body).toEqual({ code: '3002', message: 'Token expired' });
  });

  it('token hợp lệ → 200 / 1000', async () => {
    const token = await jwt.signAsync(payload);
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e-sample/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ code: '1000', message: 'OK', data: { ok: true } });
  });

  it('Swagger mở được tại /api/v1/docs (APP_ENV=test, ngoài production)', async () => {
    await request(app.getHttpServer()).get('/api/v1/docs').expect(200);
  });

  it('CORS mặc định ngoài production: chỉ trả header cho Web dev (http://localhost:5173)', async () => {
    const dev = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(dev.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
