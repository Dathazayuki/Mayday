import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RESPONSE_CODES, isResponseCode, type ResponseCode } from './response-codes.js';

const DOC_PATH = fileURLToPath(
  new URL('../../../docs/02-api/00-quy-uoc-va-ma-phan-hoi.md', import.meta.url),
);

/** Đọc bảng "Bảng mã chi tiết" trong tài liệu chuẩn: mã -> message. */
function readDocTable(): Map<string, string> {
  const text = readFileSync(DOC_PATH, 'utf8');
  const section = text.split('## Bảng mã chi tiết')[1]?.split('\n## ')[0] ?? '';
  const rows = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = /^\| (\d{4}) \| ([^|]+) \|/.exec(line);
    if (match) rows.set(match[1], match[2].trim());
  }
  return rows;
}

describe('RESPONSE_CODES', () => {
  const doc = readDocTable();

  it('đọc được bảng mã trong tài liệu chuẩn', () => {
    expect(doc.size).toBe(70);
  });

  it('chứa mọi mã của tài liệu với đúng message', () => {
    for (const [code, message] of doc) {
      expect(isResponseCode(code), `thiếu mã ${code}`).toBe(true);
      expect(RESPONSE_CODES[code as ResponseCode].message).toBe(message);
    }
  });

  it('chỉ thêm đúng mã 1001 ngoài tài liệu (MT-09)', () => {
    const extra = Object.keys(RESPONSE_CODES).filter((code) => !doc.has(code));
    expect(extra).toEqual(['1001']);
  });

  it.each([
    ['1000', 200],
    ['1001', 201],
    ['2004', 400],
    ['3001', 401],
    ['3008', 401],
    ['3101', 403],
    ['3007', 404],
    ['3006', 409],
    ['6003', 413],
    ['9901', 500],
    ['9002', 502],
  ] as const)('mã %s có HTTP status %i (MT-05)', (code, status) => {
    expect(RESPONSE_CODES[code].httpStatus).toBe(status);
  });

  it('isResponseCode từ chối mã lạ', () => {
    expect(isResponseCode('1234')).toBe(false);
    expect(isResponseCode(1000)).toBe(false);
  });
});
