import type { Career, Gender } from '@drmayday/shared';
import type { patients_nghe_nghiep, staffs, users_gioi_tinh } from '../generated/prisma/client.js';
import {
  careerFromDb,
  careerToDb,
  dateForYear,
  genderFromDb,
  genderToDb,
  isPatient,
  isoDate,
  isoDateTime,
  newUserToDb,
  normalizeFullName,
  profileUpdateToDb,
  roleIdOf,
  toCreateStaffData,
  toLoginUserInfo,
  toProfileData,
  toSignupData,
  yearFromDate,
  type UserRecord,
} from './user-mapping.js';
import { patientRecord, userRecord } from './user-record.fixture.js';

describe('gender API ↔ CSDL (MT-59)', () => {
  it.each<[Gender, users_gioi_tinh]>([
    ['male', 'Nam'],
    ['female', 'Nu'],
    ['other', 'Khac'],
  ])('%s ↔ %s', (api, db) => {
    expect(genderToDb(api)).toBe(db);
    expect(genderFromDb(db)).toBe(api);
  });

  it('CSDL null → null', () => {
    expect(genderFromDb(null)).toBeNull();
  });
});

describe('career API ↔ CSDL', () => {
  // Prisma thay dấu cách bằng "_" trong tên giá trị enum; CSDL vẫn lưu giá trị gốc qua @map.
  it.each<[Career, patients_nghe_nghiep]>([
    ['Cong nhan', 'Cong_nhan'],
    ['Nong dan', 'Nong_dan'],
    ['Hoc sinh - Sinh vien', 'Hoc_sinh___Sinh_vien'],
    ['Can bo cong chuc', 'Can_bo_cong_chuc'],
    ['Khac', 'Khac'],
  ])('%s ↔ %s', (api, db) => {
    expect(careerToDb(api)).toBe(db);
    expect(careerFromDb(db)).toBe(api);
  });

  it('CSDL null → null', () => {
    expect(careerFromDb(null)).toBeNull();
  });
});

describe('normalizeFullName', () => {
  it('bỏ khoảng trắng hai đầu và in hoa có dấu', () => {
    expect(normalizeFullName('  nguyễn văn a ')).toBe('NGUYỄN VĂN A');
  });
});

describe('năm sinh ↔ ngay_sinh (MT-13)', () => {
  it('yearFromDate lấy năm theo UTC, null → null', () => {
    expect(yearFromDate(new Date('1990-05-06'))).toBe(1990);
    expect(yearFromDate(null)).toBeNull();
  });

  it('dateForYear: năm không đổi → undefined (giữ ngày/tháng thật)', () => {
    expect(dateForYear(1990, new Date('1990-05-06'))).toBeUndefined();
  });

  it('dateForYear: năm khác → YYYY-01-01 UTC', () => {
    expect(dateForYear(1991, new Date('1990-05-06'))).toEqual(new Date('1991-01-01T00:00:00.000Z'));
  });

  it('dateForYear: chưa có ngày sinh → YYYY-01-01 UTC', () => {
    expect(dateForYear(1990, null)).toEqual(new Date('1990-01-01T00:00:00.000Z'));
  });
});

describe('ngày giờ → chuỗi API', () => {
  it('isoDate trả YYYY-MM-DD theo UTC', () => {
    expect(isoDate(new Date('2027-03-31T00:00:00.000Z'))).toBe('2027-03-31');
    expect(isoDate(null)).toBeNull();
  });

  it('isoDateTime trả ISO 8601', () => {
    expect(isoDateTime(new Date('2026-11-15T08:30:00.000Z'))).toBe('2026-11-15T08:30:00.000Z');
    expect(isoDateTime(null)).toBeNull();
  });
});

describe('roleIdOf', () => {
  const subtypes = (staffRole: number | null, patientRole: number | null) =>
    ({
      staffs: staffRole === null ? null : { role_id: staffRole },
      patients: patientRole === null ? null : { role_id: patientRole },
    }) as UserRecord;

  it('lấy role_id từ staffs hoặc patients', () => {
    expect(roleIdOf(subtypes(1, null))).toBe(1);
    expect(roleIdOf(subtypes(null, 2))).toBe(2);
  });

  it('không có bản ghi subtype → null', () => {
    expect(roleIdOf(subtypes(null, null))).toBeNull();
  });
});

describe('ghi users khi tạo tài khoản', () => {
  it('newUserToDb: họ tên in hoa, gender theo enum CSDL', () => {
    expect(
      newUserToDb({
        fullName: '  nguyễn văn a ',
        phone: '0912345678',
        passwordHash: 'hash',
        gender: 'female',
      }),
    ).toEqual({
      ho_ten: 'NGUYỄN VĂN A',
      so_dien_thoai: '0912345678',
      password_hash: 'hash',
      gioi_tinh: 'Nu',
    });
  });

  it('newUserToDb: không có gender → null', () => {
    expect(
      newUserToDb({ fullName: 'An', phone: '0912345678', passwordHash: 'hash', gender: null }),
    ).toMatchObject({ gioi_tinh: null });
  });
});

describe('profileUpdateToDb (PUT profile)', () => {
  const birthDate = new Date('1990-05-06T00:00:00.000Z');

  it('chỉ có trường của users → không có phần patients', () => {
    expect(profileUpdateToDb({ full_name: ' trần b ', gender: null }, birthDate)).toEqual({
      user: { ho_ten: 'TRẦN B', gioi_tinh: null },
    });
  });

  it('ánh xạ đủ trường bệnh nhân sang cột CSDL; null xoá giá trị, trường vắng giữ nguyên', () => {
    const { user, patient } = profileUpdateToDb(
      {
        year_of_birth: 1991,
        career: 'Hoc sinh - Sinh vien',
        ethnic: 'Kinh',
        hamlet_address: 'Thôn 1',
        commune_address: 'Xã A',
        city_address: 'Hà Nội',
        work_place: null,
        health_insurance_number: 'HS4010123456789',
        health_insurance_validate: '2027-03-31',
        next_of_kin_name: 'Nguyễn Văn B, Thôn 1',
        next_of_kin_phone: '0987654321',
      },
      birthDate,
    );
    expect(user).toEqual({ ho_ten: undefined, gioi_tinh: undefined });
    expect(patient).toEqual({
      ngay_sinh: new Date('1991-01-01T00:00:00.000Z'),
      nghe_nghiep: 'Hoc_sinh___Sinh_vien',
      dan_toc: 'Kinh',
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_tinh_tp: 'Hà Nội',
      noi_lam_viec: null,
      bhyt_so_the: 'HS4010123456789',
      bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
      nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn B, Thôn 1',
      nguoi_nha_so_dien_thoai: '0987654321',
    });
  });

  it('year_of_birth trùng năm đang lưu → không ghi ngay_sinh (MT-13); null → xoá', () => {
    expect(profileUpdateToDb({ year_of_birth: 1990 }, birthDate).patient).toBeUndefined();
    expect(profileUpdateToDb({ year_of_birth: null }, birthDate).patient).toMatchObject({
      ngay_sinh: null,
    });
  });

  it('cột chữ tự do được bỏ khoảng trắng hai đầu; còn lại chuỗi rỗng thì ghi null, không ghi ""', () => {
    const { patient } = profileUpdateToDb(
      {
        ethnic: ' Kinh ',
        commune_address: '  Xã A',
        next_of_kin_name: 'Nguyễn Văn C  ',
        work_place: '   ',
        health_insurance_number: '',
      },
      birthDate,
    );
    expect(patient).toMatchObject({
      dan_toc: 'Kinh',
      dia_chi_xa_phuong: 'Xã A',
      nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C',
      noi_lam_viec: null,
      bhyt_so_the: null,
    });
  });
});

describe('isPatient', () => {
  it('bệnh nhân có bản ghi patients, nhân viên thì không', () => {
    expect(isPatient(userRecord())).toBe(true);
    expect(isPatient(userRecord({ staffs: { role_id: 1 } as staffs, patients: null }))).toBe(false);
  });
});

describe('toProfileData (GET/PUT profile)', () => {
  const COMMON = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678' };

  it('bệnh nhân: đủ 17 trường của tab Sheet, ID kiểu int (MT-06), ngày theo YYYY-MM-DD / ISO 8601', () => {
    const record = userRecord({
      gioi_tinh: 'Nu',
      patients: patientRecord({
        ngay_sinh: new Date('1990-05-06T00:00:00.000Z'),
        nghe_nghiep: 'Can_bo_cong_chuc',
        dan_toc: 'Kinh',
        dia_chi_so_nha_thon_pho: 'Thôn 1',
        dia_chi_xa_phuong: 'Xã A',
        dia_chi_tinh_tp: 'Hà Nội',
        noi_lam_viec: 'Công ty B',
        bhyt_so_the: 'HS4010123456789',
        bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C, Thôn 1',
        nguoi_nha_so_dien_thoai: '0987654321',
        thoi_diem_kham_lan_dau: new Date('2026-11-15T08:30:00.000Z'),
      }),
    });
    expect(toProfileData(record, 2)).toStrictEqual({
      ...COMMON,
      role_id: 2,
      gender: 'female',
      year_of_birth: 1990,
      career: 'Can bo cong chuc',
      ethnic: 'Kinh',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      work_place: 'Công ty B',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
      first_visit: '2026-11-15T08:30:00.000Z',
    });
  });

  it('bệnh nhân chưa điền hồ sơ: vẫn đủ 17 khoá, giá trị null', () => {
    expect(toProfileData(userRecord(), 2)).toStrictEqual({
      ...COMMON,
      role_id: 2,
      gender: null,
      year_of_birth: null,
      career: null,
      ethnic: null,
      hamlet_address: null,
      commune_address: null,
      city_address: null,
      work_place: null,
      health_insurance_number: null,
      health_insurance_validate: null,
      next_of_kin_name: null,
      next_of_kin_phone: null,
      first_visit: null,
    });
  });

  it('nhân viên: chỉ 5 trường chung (tab Sheet ghi "dưới đây là của bệnh nhân")', () => {
    const staff = userRecord({
      gioi_tinh: 'Nam',
      staffs: { user_id: 7, role_id: 1 } as staffs,
      patients: null,
    });
    expect(toProfileData(staff, 1)).toStrictEqual({ ...COMMON, role_id: 1, gender: 'male' });
  });
});

describe('UserRecord → data trả về', () => {
  const record = {
    user_id: 7,
    ho_ten: 'NGUYỄN VĂN A',
    so_dien_thoai: '0912345678',
    gioi_tinh: 'Khac',
    is_active: true,
    created_at: new Date('2026-11-15T01:02:03.000Z'),
  } as UserRecord;

  it('toSignupData: ID và is_active kiểu int, created_at ISO (MT-06)', () => {
    expect(toSignupData(record, 2)).toEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      gender: 'other',
      role_id: 2,
      is_active: 1,
      created_at: '2026-11-15T01:02:03.000Z',
    });
  });

  it('toCreateStaffData: mọi trường kiểu int, room_id null khi không có phòng (MT-06, MT-37)', () => {
    const assignment = { roleId: 6, branchId: 10, departmentId: 20, roomId: null };
    expect(toCreateStaffData(record, assignment)).toEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      role_id: 6,
      branch_id: 10,
      department_id: 20,
      room_id: null,
    });
  });

  it('toLoginUserInfo: mọi trường kiểu string (MT-06)', () => {
    expect(toLoginUserInfo(record, 2)).toEqual({
      user_id: '7',
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      role_id: '2',
    });
  });
});
