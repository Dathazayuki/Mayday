import { Logger } from '@nestjs/common';
import type { CreatePatientRequest } from '@drmayday/shared';
import type { PasswordService } from '../auth/password.service.js';
import { Paginated } from '../common/paginated.js';
import type { RoleRecord } from '../roles/role-mapping.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { CreatePatientDto, SearchPatientsQuery, UpdatePatientDto } from './dto/patient.dto.js';
import { patientRecord } from './patient-record.fixture.js';
import type { PatientsRepository } from './patients.repository.js';
import { PatientsService } from './patients.service.js';

const PATIENT_ROLE: RoleRecord = {
  id: 4,
  name: 'benh_nhan',
  displayName: 'Bệnh nhân',
  description: null,
};
/** toPatientData(patientRecord()). */
const DATA = {
  user_id: 7,
  full_name: 'LÊ THỊ MAI',
  phone: '0911111111',
  role_id: 4,
  gender: 'female',
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
  has_account: true,
  created_at: '2026-11-15T01:02:03.000Z',
};

function setup() {
  const patients = {
    search: vi.fn<PatientsRepository['search']>().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn<PatientsRepository['findById']>().mockResolvedValue(patientRecord()),
    create: vi.fn<PatientsRepository['create']>().mockResolvedValue(patientRecord()),
    update: vi.fn<PatientsRepository['update']>().mockResolvedValue(patientRecord()),
  };
  const users = { loginExists: vi.fn<UsersRepository['loginExists']>().mockResolvedValue(false) };
  const roles = {
    findByName: vi.fn<RolesRepository['findByName']>().mockResolvedValue(PATIENT_ROLE),
  };
  const passwords = { hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`) };
  const service = new PatientsService(
    patients as unknown as PatientsRepository,
    users as unknown as UsersRepository,
    roles as unknown as RolesRepository,
    passwords as unknown as PasswordService,
  );
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, patients, users, roles, logError };
}

/** Query đã qua ValidationPipe: phân trang mặc định, ghi đè bằng `fields`. */
const query = (fields: Partial<SearchPatientsQuery> = {}) =>
  ({ page: 1, limit: 20, ...fields }) as SearchPatientsQuery;

describe('PatientsService (spec B, mục 5.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search (docpat01)', () => {
    it('bộ lọc + cửa sổ trang → repository; phần tử theo contract, total giữ nguyên', async () => {
      const { service, patients } = setup();
      patients.search.mockResolvedValue({
        items: [
          {
            id: 7,
            fullName: 'LÊ THỊ MAI',
            phone: '0911111111',
            gender: 'female',
            birthDate: new Date('1990-01-01T00:00:00.000Z'),
            hasAccount: true,
          },
        ],
        total: 41,
      });
      const result = await service.search(
        query({ keyword: 'mai', gender: 'female', page: 3, limit: 10 }),
      );
      expect(patients.search).toHaveBeenCalledWith(
        { keyword: 'mai', gender: 'female', birthYears: undefined },
        { skip: 20, take: 10 },
      );
      expect(result).toStrictEqual(
        new Paginated(
          [
            {
              user_id: 7,
              full_name: 'LÊ THỊ MAI',
              phone: '0911111111',
              gender: 'female',
              year_of_birth: 1990,
              has_account: true,
            },
          ],
          41,
        ),
      );
    });

    it.each<[string, Partial<SearchPatientsQuery>, { from: number; to: number } | undefined]>([
      ['chỉ min_year', { min_year: 1990 }, { from: 1990, to: 1990 }],
      ['chỉ max_year', { max_year: 1990 }, { from: 1990, to: 1990 }],
      ['min_year = 0', { min_year: 0, max_year: 1990 }, { from: 1990, to: 1990 }],
      ['max_year = 0', { min_year: 1990, max_year: 0 }, { from: 1990, to: 1990 }],
      ['hai năm bằng nhau', { min_year: 1990, max_year: 1990 }, { from: 1990, to: 1990 }],
      ['khoảng năm', { min_year: 1985, max_year: 1990 }, { from: 1985, to: 1990 }],
      ['cả hai là 0', { min_year: 0, max_year: 0 }, undefined],
    ])('luật năm của Sheet: %s', async (_name, years, birthYears) => {
      const { service, patients } = setup();
      await service.search(query(years));
      expect(patients.search).toHaveBeenCalledWith(
        expect.objectContaining({ birthYears }),
        expect.anything(),
      );
    });

    it('cả hai khác 0 mà min_year > max_year → 2003 (min_year), không tìm', async () => {
      const { service, patients } = setup();
      await expect(service.search(query({ min_year: 1991, max_year: 1990 }))).rejects.toMatchObject(
        { code: '2003', data: { field: 'min_year' } },
      );
      expect(patients.search).not.toHaveBeenCalled();
    });
  });

  describe('get (GET /doctor/patients/:id)', () => {
    it('PatientData', async () => {
      const { service, patients } = setup();
      await expect(service.get(7)).resolves.toStrictEqual(DATA);
      expect(patients.findById).toHaveBeenCalledWith(7);
    });

    it('không có dòng benhnhan (nhân viên, không tồn tại) → 3007', async () => {
      const { service, patients } = setup();
      patients.findById.mockResolvedValue(null);
      await expect(service.get(7)).rejects.toMatchObject({ code: '3007' });
    });
  });

  describe('create (docpat02)', () => {
    const dto = {
      full_name: '  lê thị mai ',
      phone: '0911111111',
      password: 'matkhau',
      gender: 'female',
      year_of_birth: 1990,
      ethnic: 'Kinh',
    } as CreatePatientDto;

    it('số đã là tên đăng nhập → 3006, không tạo', async () => {
      const { service, users, patients } = setup();
      users.loginExists.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.loginExists).toHaveBeenCalledWith('0911111111');
      expect(patients.create).not.toHaveBeenCalled();
    });

    it('băm mật khẩu, vai trò benh_nhan; trường hồ sơ tách khỏi trường tài khoản; trả PatientData', async () => {
      const { service, patients, roles } = setup();
      await expect(service.create(dto)).resolves.toStrictEqual(DATA);
      expect(roles.findByName).toHaveBeenCalledWith('benh_nhan');
      expect(patients.create).toHaveBeenCalledWith(
        {
          fullName: '  lê thị mai ',
          phone: '0911111111',
          passwordHash: 'hash-cua-matkhau',
          gender: 'female',
          roleId: 4,
        },
        { year_of_birth: 1990, ethnic: 'Kinh' },
      );
    });

    it('không gửi gender → null', async () => {
      const { service, patients } = setup();
      await service.create({
        ...(dto as CreatePatientRequest),
        gender: undefined,
      } as CreatePatientDto);
      expect(patients.create).toHaveBeenCalledWith(
        expect.objectContaining({ gender: null }),
        expect.anything(),
      );
    });

    it('CSDL chưa có vai trò benh_nhan (chưa nạp schema) → 9901 và log, không tạo', async () => {
      const { service, roles, patients, logError } = setup();
      roles.findByName.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('"benh_nhan"'));
      expect(patients.create).not.toHaveBeenCalled();
    });
  });

  describe('update (luật của PUT /profile, spec A mục 5.3)', () => {
    it('ghi qua repository → PatientData', async () => {
      const { service, patients } = setup();
      const dto = { ethnic: 'Kinh' } as UpdatePatientDto;
      await expect(service.update(7, dto)).resolves.toStrictEqual(DATA);
      expect(patients.update).toHaveBeenCalledWith(7, dto);
    });

    it('không có trường nào → 2001, không ghi', async () => {
      const { service, patients } = setup();
      await expect(service.update(7, {} as UpdatePatientDto)).rejects.toMatchObject({
        code: '2001',
      });
      expect(patients.update).not.toHaveBeenCalled();
    });

    it.each([null, '   '])('full_name = %j → 2003 (full_name), không ghi', async (fullName) => {
      const { service, patients } = setup();
      await expect(
        service.update(7, { full_name: fullName } as unknown as UpdatePatientDto),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'full_name' } });
      expect(patients.update).not.toHaveBeenCalled();
    });

    it('không phải bệnh nhân → 3007', async () => {
      const { service, patients } = setup();
      patients.update.mockResolvedValue(null);
      await expect(service.update(7, { ethnic: 'Kinh' } as UpdatePatientDto)).rejects.toMatchObject(
        { code: '3007' },
      );
    });
  });
});
