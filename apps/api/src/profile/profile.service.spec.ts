import { Logger } from '@nestjs/common';
import type { UpdateProfileRequest } from '@drmayday/shared';
import { patientFields, staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { ProfileService } from './profile.service.js';

const BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };
const EMPTY_PATIENT_FIELDS = {
  year_of_birth: null,
  career: null,
  ethnic: null,
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  health_insurance_number: null,
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};

function setup() {
  const users = {
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(userRecord()),
    updateProfile: vi
      .fn<UsersRepository['updateProfile']>()
      .mockResolvedValue(
        userRecord({ fullName: 'TRẦN VĂN B', patient: patientFields({ ethnic: 'Kinh' }) }),
      ),
  };
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service: new ProfileService(users as unknown as UsersRepository), users, logError };
}

describe('ProfileService (spec A, mục 5.3, D4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('vai trò benh_nhan: 16 trường, role_id từ taikhoan, chưa có giá trị là null', async () => {
      const { service } = setup();
      await expect(service.get(7)).resolves.toStrictEqual({
        ...BASE,
        role_id: 4,
        ...EMPTY_PATIENT_FIELDS,
      });
    });

    it('vai trò khác: 5 trường chung, kể cả khi chưa có dòng nhanvien', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord({ staff: null }));
      await expect(service.get(7)).resolves.toStrictEqual({ ...BASE, role_id: 2 });
    });

    it('không còn tài khoản → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.get(7)).rejects.toMatchObject({ code: '3007' });
    });

    it('vai trò benh_nhan thiếu dòng benhnhan → 9901 và log (MT-112)', async () => {
      const { service, users, logError } = setup();
      users.findById.mockResolvedValue(userRecord({ patient: null }));
      await expect(service.get(7)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('MT-112'));
    });
  });

  describe('update', () => {
    it.each<[string, UpdateProfileRequest, string]>([
      ['body rỗng', {}, '2001'],
      ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
    ])('%s → %s, không đọc/ghi CSDL', async (_name, dto, code) => {
      const { service, users } = setup();
      await expect(service.update(7, dto)).rejects.toMatchObject({ code });
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('nhân viên gửi trường của bệnh nhân → 2003 kèm field, không ghi', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord());
      await expect(
        service.update(7, { full_name: 'A', city_address: 'Huế' }),
      ).rejects.toMatchObject({
        code: '2003',
        data: { field: 'city_address' },
      });
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it('bệnh nhân: chuyển nguyên thay đổi cho repository, trả hồ sơ sau khi ghi', async () => {
      const { service, users } = setup();
      const dto = { full_name: 'trần văn b', ethnic: 'Kinh', career: null };
      await expect(service.update(7, dto)).resolves.toMatchObject({
        full_name: 'TRẦN VĂN B',
        ethnic: 'Kinh',
      });
      expect(users.updateProfile).toHaveBeenCalledWith(7, dto);
    });

    it('bị xoá đúng lúc ghi (repository trả null) → 3007', async () => {
      const { service, users } = setup();
      users.updateProfile.mockResolvedValue(null);
      await expect(service.update(7, { full_name: 'A' })).rejects.toMatchObject({ code: '3007' });
    });
  });
});
