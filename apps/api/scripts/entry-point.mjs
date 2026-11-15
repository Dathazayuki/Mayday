import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * File có `moduleUrl` (import.meta.url) là lệnh đang chạy, hay chỉ được import (test, lệnh khác dùng
 * hàm của nó)? So đường dẫn tuyệt đối đã chuẩn hoá; Windows không phân biệt hoa/thường (ổ c: và C:).
 */
export function isEntryPoint(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const normalize = (path) =>
    process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  return normalize(entry) === normalize(fileURLToPath(moduleUrl));
}
