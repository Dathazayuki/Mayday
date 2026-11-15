/**
 * Môi trường chạy của API. Dùng biến riêng APP_ENV thay vì NODE_ENV: file .env ở thư mục gốc dùng
 * chung với Web, Vite đọc NODE_ENV từ đó và sẽ build Web ở chế độ development.
 */
export const APP_ENVS = ['development', 'test', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Biến môi trường của API. Danh sách chuẩn: .env.example ở thư mục gốc. */
export interface Env {
  /** Chưa đặt thì nơi dùng coi như production: tính năng chỉ dành cho dev (VD log OTP) bị tắt. */
  APP_ENV?: AppEnv;
  PORT: number;
  /** Bắt buộc khi APP_ENV=production; môi trường khác để trống thì /health báo db: not_configured. */
  DATABASE_URL?: string;
  /**
   * Origin trình duyệt được gọi API (CORS), đọc từ chuỗi cách nhau bởi dấu phẩy. Chưa đặt thì
   * development/test cho phép Web dev (DEV_WEB_ORIGIN), production không cho origin nào.
   */
  CORS_ORIGINS?: string[];
  JWT_SECRET: string;
  /** Thời hạn access token, tính bằng giây. */
  JWT_EXPIRES_IN: number;
  MINIO_ENDPOINT?: string;
  MINIO_PORT?: number;
  MINIO_ACCESS_KEY?: string;
  MINIO_SECRET_KEY?: string;
  MINIO_BUCKET?: string;
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function positiveInt(
  raw: Record<string, unknown>,
  key: string,
  errors: string[],
  fallback?: number,
): number | undefined {
  const value = optionalString(raw, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${key} phải là số nguyên dương (đang là "${value}")`);
    return fallback;
  }
  return parsed;
}

function appEnv(raw: Record<string, unknown>, errors: string[]): AppEnv | undefined {
  const value = optionalString(raw, 'APP_ENV');
  if (value === undefined) return undefined;
  const known = APP_ENVS.find((name) => name === value);
  if (!known) errors.push(`APP_ENV phải là ${APP_ENVS.join(', ')} (đang là "${value}")`);
  return known;
}

/** `http(s)://host[:cổng]`, không có đường dẫn hay dấu `/` cuối: đúng dạng header Origin. */
const ORIGIN_PATTERN = /^https?:\/\/[^\s/?#@]+$/i;

function corsOrigins(raw: Record<string, unknown>, errors: string[]): string[] | undefined {
  const value = optionalString(raw, 'CORS_ORIGINS');
  if (value === undefined) return undefined;
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  const invalid = origins.filter((origin) => !ORIGIN_PATTERN.test(origin));
  if (invalid.length > 0) {
    errors.push(
      `CORS_ORIGINS phải là các origin dạng http(s)://host[:cổng], cách nhau bởi dấu phẩy, không có / cuối (sai: ${invalid.map((origin) => `"${origin}"`).join(', ')})`,
    );
  }
  return origins.length > 0 ? origins : undefined;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const jwtSecret = optionalString(raw, 'JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    errors.push('JWT_SECRET là bắt buộc và phải dài tối thiểu 32 ký tự');
  }
  const runtimeEnv = appEnv(raw, errors);
  const databaseUrl = optionalString(raw, 'DATABASE_URL');
  if (runtimeEnv === 'production' && databaseUrl === undefined) {
    errors.push('DATABASE_URL là bắt buộc khi APP_ENV=production');
  }

  const env: Env = {
    APP_ENV: runtimeEnv,
    PORT: positiveInt(raw, 'PORT', errors, 3000) ?? 3000,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins(raw, errors),
    JWT_SECRET: jwtSecret ?? '',
    JWT_EXPIRES_IN: positiveInt(raw, 'JWT_EXPIRES_IN', errors, 86400) ?? 86400,
    MINIO_ENDPOINT: optionalString(raw, 'MINIO_ENDPOINT'),
    MINIO_PORT: positiveInt(raw, 'MINIO_PORT', errors),
    MINIO_ACCESS_KEY: optionalString(raw, 'MINIO_ACCESS_KEY'),
    MINIO_SECRET_KEY: optionalString(raw, 'MINIO_SECRET_KEY'),
    MINIO_BUCKET: optionalString(raw, 'MINIO_BUCKET'),
  };

  if (errors.length > 0) {
    throw new Error(`Cấu hình môi trường không hợp lệ:\n- ${errors.join('\n- ')}`);
  }
  return env;
}
