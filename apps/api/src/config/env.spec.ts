import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const base = { JWT_SECRET: 'mot-chuoi-bi-mat-du-dai-cho-unit-test-32' };

  it('dùng giá trị mặc định cho PORT và JWT_EXPIRES_IN', () => {
    expect(validateEnv(base)).toMatchObject({ PORT: 3000, JWT_EXPIRES_IN: 86400 });
  });

  it('coi DATABASE_URL rỗng là chưa cấu hình', () => {
    expect(validateEnv({ ...base, DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
  });

  it('đọc số từ chuỗi', () => {
    expect(validateEnv({ ...base, PORT: '4000', JWT_EXPIRES_IN: '600', MINIO_PORT: '9000' })).toMatchObject({
      PORT: 4000,
      JWT_EXPIRES_IN: 600,
      MINIO_PORT: 9000,
    });
  });

  it('báo lỗi khi thiếu JWT_SECRET', () => {
    expect(() => validateEnv({})).toThrow(/JWT_SECRET/);
  });

  it('báo lỗi khi JWT_SECRET quá ngắn', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('báo lỗi khi PORT không phải số nguyên dương', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
