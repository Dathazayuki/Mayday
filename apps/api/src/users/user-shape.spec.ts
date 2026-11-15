import type { Logger } from '@nestjs/common';
import { requireShape } from './user-shape.js';
import { staffUserRecord, userRecord } from './user-record.fixture.js';

const fakeLogger = () => {
  const log = { error: vi.fn() };
  return { log, logger: log as unknown as Logger };
};

describe('requireShape (spec A, D4)', () => {
  it('vai trò benh_nhan có dòng benhnhan → dạng bệnh nhân, không ghi log', () => {
    const { log, logger } = fakeLogger();
    expect(requireShape(userRecord(), logger)).toMatchObject({ shape: 'patient', userId: 7 });
    expect(log.error).not.toHaveBeenCalled();
  });

  it('vai trò khác → dạng nhân viên, kể cả khi chưa có dòng nhanvien (MT-106)', () => {
    const { logger } = fakeLogger();
    expect(requireShape(staffUserRecord({ staff: null }), logger).shape).toBe('staff');
  });

  it('dạng theo vai trò, không theo bảng subtype đang có', () => {
    const { logger } = fakeLogger();
    const doctorWithPatientRow = staffUserRecord({ patient: userRecord().patient });
    expect(requireShape(doctorWithPatientRow, logger).shape).toBe('staff');
  });

  it('vai trò benh_nhan thiếu dòng benhnhan → 9901 và ghi log (MT-112)', () => {
    const { log, logger } = fakeLogger();
    expect(() => requireShape(userRecord({ patient: null }), logger)).toThrow(
      expect.objectContaining({ code: '9901' }),
    );
    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      'Tài khoản của người 7 có vai trò benh_nhan nhưng không có dòng benhnhan (MT-112)',
    );
  });
});
