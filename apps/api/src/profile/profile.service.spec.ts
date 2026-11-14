import { Logger } from '@nestjs/common';
import type { UpdateProfileRequest } from '@drmayday/shared';
import type { staffs } from '../generated/prisma/client.js';
import { toProfileData } from '../users/user-mapping.js';
import { userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { ProfileService } from './profile.service.js';

const PATIENT_ROLE_ID = 2;
const ADMIN_ROLE_ID = 1;
const PATIENT = userRecord();
const STAFF = userRecord({
  staffs: { user_id: 7, role_id: ADMIN_ROLE_ID } as staffs,
  patients: null,
});

function setup() {
  const users = {
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(PATIENT),
    updateProfile: vi
      .fn<UsersRepository['updateProfile']>()
      .mockResolvedValue(userRecord({ ho_ten: 'TRẦN VĂN B' })),
  };
  const service = new ProfileService(users as unknown as UsersRepository);
  // Lỗi 9901 được ghi log; chặn log để output test gọn và kiểm tra nội dung.
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, logError };
}

describe('ProfileService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('bệnh nhân: đủ 17 trường (toProfileData với role_id của patients)', async () => {
      const { service, users } = setup();
      const profile = await service.get(7);
      expect(users.findById).toHaveBeenCalledWith(7);
      expect(profile).toStrictEqual(toProfileData(PATIENT, PATIENT_ROLE_ID));
      expect(Object.keys(profile)).toHaveLength(17);
    });

    it('nhân viên: chỉ 5 trường, role_id lấy từ staffs', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(STAFF);
      await expect(service.get(7)).resolves.toStrictEqual({
        user_id: 7,
        full_name: 'NGUYỄN VĂN A',
        phone: '0912345678',
        role_id: ADMIN_ROLE_ID,
        gender: null,
      });
    });

    it('người dùng không còn tồn tại → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.get(7)).rejects.toMatchObject({ code: '3007' });
    });

    it('người dùng không có bản ghi staffs/patients → 9901 và ghi log', async () => {
      const { service, users, logError } = setup();
      users.findById.mockResolvedValue(userRecord({ patients: null }));
      await expect(service.get(7)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('Người dùng 7'));
    });
  });

  describe('update', () => {
    it.each<[string, UpdateProfileRequest]>([
      ['body rỗng', {}],
      ['mọi trường đều vắng', { full_name: undefined, ethnic: undefined }],
    ])('%s → 2001, không đọc/ghi CSDL', async (_name, dto) => {
      const { service, users } = setup();
      await expect(service.update(7, dto)).rejects.toMatchObject({ code: '2001' });
      expect(users.findById).not.toHaveBeenCalled();
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it.each<[string, unknown]>([
      ['chỉ có khoảng trắng', '  '],
      ['chuỗi rỗng', ''],
      ['null', null],
    ])('full_name %s → 2003 (họ tên không xoá được)', async (_name, fullName) => {
      const { service, users } = setup();
      const dto = { full_name: fullName } as UpdateProfileRequest;
      await expect(service.update(7, dto)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'full_name' },
      });
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it('người dùng không còn tồn tại → 3007, không ghi CSDL', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.update(7, { full_name: 'Trần Văn B' })).rejects.toMatchObject({
        code: '3007',
      });
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it.each<[string, UpdateProfileRequest, string]>([
      ['career', { full_name: 'Trần Văn B', career: 'Khac' }, 'career'],
      ['ethnic = null', { ethnic: null }, 'ethnic'],
    ])('nhân viên gửi trường của bệnh nhân (%s) → 2003, không ghi CSDL', async (_n, dto, field) => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(STAFF);
      await expect(service.update(7, dto)).rejects.toMatchObject({ code: '2003', data: { field } });
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it('nhân viên sửa full_name, gender → ghi CSDL, trả 5 trường', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(STAFF);
      users.updateProfile.mockResolvedValue(STAFF);
      const profile = await service.update(7, { full_name: 'Trần Văn B', gender: 'male' });
      expect(users.updateProfile).toHaveBeenCalledWith(7, {
        full_name: 'Trần Văn B',
        gender: 'male',
      });
      expect(Object.keys(profile)).toHaveLength(5);
    });

    it('bệnh nhân: chuyển nguyên thay đổi cho repository (chuỗi rỗng = xoá, profileUpdateToDb đổi thành null)', async () => {
      const { service, users } = setup();
      const dto: UpdateProfileRequest = { ethnic: '', year_of_birth: 1990, work_place: null };
      await service.update(7, dto);
      expect(users.updateProfile).toHaveBeenCalledWith(7, dto);
    });

    it('trả hồ sơ của bản ghi mà repository trả về sau khi ghi', async () => {
      const { service } = setup();
      const profile = await service.update(7, { full_name: 'trần văn b' });
      expect(profile).toStrictEqual(
        toProfileData(userRecord({ ho_ten: 'TRẦN VĂN B' }), PATIENT_ROLE_ID),
      );
    });

    it('người dùng không có bản ghi staffs/patients → 9901, không ghi CSDL', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(userRecord({ patients: null }));
      await expect(service.update(7, { full_name: 'Trần Văn B' })).rejects.toMatchObject({
        code: '9901',
      });
      expect(users.updateProfile).not.toHaveBeenCalled();
    });
  });
});
