import type { Logger } from '@nestjs/common';
import type { staffs } from '../generated/prisma/client.js';
import { requireRoleId } from './require-role-id.js';
import { userRecord } from './user-record.fixture.js';

describe('requireRoleId', () => {
  const fakeLogger = () => {
    const log = { error: vi.fn() };
    return { log, logger: log as unknown as Logger };
  };

  it('trả role_id của staffs hoặc patients, không ghi log', () => {
    const { log, logger } = fakeLogger();
    expect(requireRoleId(userRecord(), logger)).toBe(2);
    const staff = userRecord({ staffs: { role_id: 1 } as staffs, patients: null });
    expect(requireRoleId(staff, logger)).toBe(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('không có bản ghi staffs/patients (dữ liệu hỏng) → ghi log rồi ném 9901', () => {
    const { log, logger } = fakeLogger();
    expect(() => requireRoleId(userRecord({ patients: null }), logger)).toThrow(
      expect.objectContaining({ code: '9901' }),
    );
    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      'Người dùng 7 không có bản ghi staffs hoặc patients',
    );
  });
});
