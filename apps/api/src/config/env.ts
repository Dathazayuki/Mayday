/** Biến môi trường của API. Danh sách chuẩn: .env.example ở thư mục gốc. */
export interface Env {
  PORT: number;
  DATABASE_URL?: string;
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

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const jwtSecret = optionalString(raw, 'JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    errors.push('JWT_SECRET là bắt buộc và phải dài tối thiểu 32 ký tự');
  }

  const env: Env = {
    PORT: positiveInt(raw, 'PORT', errors, 3000) ?? 3000,
    DATABASE_URL: optionalString(raw, 'DATABASE_URL'),
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
