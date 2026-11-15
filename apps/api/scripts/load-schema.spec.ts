import { existsSync } from 'node:fs';
import { assertLocalDatabase, loadSchema, SQL_PATH } from './load-schema.mjs';

const SECRET = 'mat-khau-bi-mat';
const urlAt = (host: string) => `postgresql://drmayday:${SECRET}@${host}:5434/drmayday_test`;

function errorOf(action: () => void): Error {
  try {
    action();
  } catch (error) {
    return error as Error;
  }
  throw new Error('mong đợi có lỗi');
}

describe('assertLocalDatabase (D2)', () => {
  it.each(['127.0.0.1', 'localhost', '[::1]'])('host %s → cho chạy', (host) => {
    expect(() => assertLocalDatabase(urlAt(host))).not.toThrow();
  });

  it.each(['db.truong.edu.vn', '10.0.0.5', '127.0.0.1.nip.io'])(
    'host %s → từ chối, thông báo nêu host nhưng không lộ mật khẩu',
    (host) => {
      const error = errorOf(() => assertLocalDatabase(urlAt(host)));
      expect(error.message).toMatch(/Chỉ chạy trên CSDL nằm trên máy này/);
      expect(error.message).toContain(host);
      expect(error.message).not.toContain(SECRET);
    },
  );

  it.each(['?host=remote.example', '?hostaddr=1.2.3.4', '?host=localhost'])(
    'tham số %s có thể đổi host kết nối → từ chối, không lộ mật khẩu',
    (query) => {
      const error = errorOf(() => assertLocalDatabase(`${urlAt('localhost')}${query}`));
      expect(error.message).toMatch(/tham số host/);
      expect(error.message).not.toContain(SECRET);
    },
  );

  it('URL sai dạng → từ chối', () => {
    expect(() => assertLocalDatabase('khong-phai-url')).toThrow(/URL CSDL không hợp lệ/);
  });
});

describe('loadSchema', () => {
  it('từ chối CSDL ngoài máy này trước khi kết nối', async () => {
    await expect(loadSchema(urlAt('db.truong.edu.vn'))).rejects.toThrow(/máy này/);
  });

  it('SQL_PATH trỏ tới bản sao file SQL của nhóm DB', () => {
    expect(SQL_PATH.replace(/\\/g, '/')).toMatch(
      /prisma\/vendor\/mayday-database\/final_restructured\.sql$/,
    );
    expect(existsSync(SQL_PATH)).toBe(true);
  });
});
