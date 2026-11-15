import {
  accountChangesToDb,
  careerFromDb,
  dateForYear,
  genderFromDb,
  genderToDb,
  newAccountToDb,
  personChangesToDb,
  profileUpdateToDb,
  toAdminUserDetail,
  toAssignUserData,
  toCreateStaffData,
  toLoginUserInfo,
  toProfileData,
  toSessionAccount,
  toSignupData,
  toUserRecord,
  toUserSummary,
  type AccountRow,
  type ShapedUser,
} from './user-mapping.js';
import { patientFields, staffUserRecord, userRecord } from './user-record.fixture.js';

const AT = new Date('2026-11-15T01:02:03.000Z');
const UPDATED_AT = new Date('2026-11-15T05:00:00.000Z');

/** Hàng taikhoan kèm include của repository (ACCOUNT_INCLUDE): bệnh nhân có một hồ sơ. */
function accountRow(): AccountRow {
  return {
    ma_tai_khoan: 70n,
    ma_nguoi: 7n,
    ma_vai_tro: 4n,
    ten_dang_nhap: '0912345678',
    mat_khau_ma_hoa: 'hash',
    trang_thai_hoat_dong: true,
    thoi_diem_tao: AT,
    thoi_diem_cap_nhat: UPDATED_AT,
    vaitro: { ten_vai_tro: 'benh_nhan' },
    nguoi: {
      ma_nguoi: 7n,
      ho_ten: 'NGUYỄN VĂN A',
      ngay_sinh: new Date('1990-05-06T00:00:00.000Z'),
      gioi_tinh: 'Nu',
      so_dien_thoai: '0912345678',
      dia_chi_tinh_tp: 'Hà Nội',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      thoi_diem_tao: AT,
      thoi_diem_cap_nhat: AT,
      nhanvien: null,
      benhnhan: {
        ma_benh_nhan: 7n,
        ma_his: null,
        nghe_nghiep: 'Can bo cong chuc',
        dan_toc: 'Kinh',
        bhyt_so_the: 'HS4010123456789',
        bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C, Thôn 1',
        nguoi_nha_so_dien_thoai: '0987654321',
        hosobenhan: [{ thoi_diem_kham_lan_dau: new Date('2026-11-15T08:30:00.000Z') }],
      },
    },
  } as AccountRow;
}

const patient = (record = userRecord()): ShapedUser => ({
  ...record,
  shape: 'patient',
  patient: record.patient ?? patientFields(),
});
const staff = (record = staffUserRecord()): ShapedUser => ({ ...record, shape: 'staff' });

describe('giá trị gender, career (spec A, mục 4.1 (a))', () => {
  it('gender: male ↔ Nam, female ↔ Nu; CSDL null hoặc giá trị lạ → null (MT-59)', () => {
    expect(genderToDb('male')).toBe('Nam');
    expect(genderToDb('female')).toBe('Nu');
    expect(genderFromDb('Nam')).toBe('male');
    expect(genderFromDb('Nu')).toBe('female');
    expect(genderFromDb(null)).toBeNull();
    expect(genderFromDb('Khac')).toBeNull();
  });

  it('career: đúng 5 giá trị của ck_benh_nhan_nghe_nghiep; giá trị khác → null', () => {
    expect(careerFromDb('Hoc sinh - Sinh vien')).toBe('Hoc sinh - Sinh vien');
    expect(careerFromDb(null)).toBeNull();
    expect(careerFromDb('Bac si')).toBeNull();
  });
});

describe('hàng CSDL → bản ghi miền', () => {
  it('toUserRecord: id bigint → number, ngày giữ Date, first_visit = hồ sơ sớm nhất (D14)', () => {
    expect(toUserRecord(accountRow())).toEqual({
      userId: 7,
      accountId: 70,
      roleId: 4,
      roleName: 'benh_nhan',
      fullName: 'NGUYỄN VĂN A',
      phone: '0912345678',
      gender: 'female',
      isActive: true,
      passwordHash: 'hash',
      createdAt: AT,
      accountUpdatedAt: UPDATED_AT,
      person: {
        birthDate: new Date('1990-05-06T00:00:00.000Z'),
        hamletAddress: 'Thôn 1',
        communeAddress: 'Xã A',
        cityAddress: 'Hà Nội',
      },
      patient: {
        career: 'Can bo cong chuc',
        ethnic: 'Kinh',
        insuranceNumber: 'HS4010123456789',
        insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
        nextOfKinName: 'Nguyễn Văn C, Thôn 1',
        nextOfKinPhone: '0987654321',
        firstVisit: new Date('2026-11-15T08:30:00.000Z'),
      },
      staff: null,
    });
  });

  it('toUserRecord: chưa có hồ sơ → firstVisit null; có nhanvien → staff.branchId', () => {
    const row = accountRow();
    row.nguoi.benhnhan!.hosobenhan = [];
    expect(toUserRecord(row).patient?.firstVisit).toBeNull();
    row.nguoi.benhnhan = null;
    row.nguoi.nhanvien = { ma_chi_nhanh: 10n };
    expect(toUserRecord(row)).toMatchObject({ patient: null, staff: { branchId: 10 } });
  });

  it('toSessionAccount', () => {
    expect(
      toSessionAccount({
        ma_vai_tro: 2n,
        trang_thai_hoat_dong: false,
        thoi_diem_cap_nhat: UPDATED_AT,
      }),
    ).toEqual({ roleId: 2, isActive: false, updatedAt: UPDATED_AT });
  });
});

describe('ghi tài khoản mới (spec A, mục 4.5, D16)', () => {
  const account = {
    fullName: '  nguyễn văn a ',
    phone: '0912345678',
    passwordHash: 'hash',
    gender: 'female' as const,
    roleId: 4,
  };

  it('bệnh nhân: nguoi (in hoa) + taikhoan (tên đăng nhập = số điện thoại) + benhnhan', () => {
    expect(newAccountToDb(account, { kind: 'patient' })).toEqual({
      ho_ten: 'NGUYỄN VĂN A',
      so_dien_thoai: '0912345678',
      gioi_tinh: 'Nu',
      taikhoan: {
        create: {
          ten_dang_nhap: '0912345678',
          mat_khau_ma_hoa: 'hash',
          trang_thai_hoat_dong: true,
          ma_vai_tro: 4n,
        },
      },
      benhnhan: { create: {} },
    });
  });

  it('nhân viên được phân công: thêm nhanvien; chưa phân công (D5): không có subtype; khoá tài khoản', () => {
    expect(
      newAccountToDb({ ...account, roleId: 2 }, { kind: 'staff', branchId: 10 }),
    ).toMatchObject({
      nhanvien: { create: { ma_chi_nhanh: 10n } },
    });
    const none = newAccountToDb({ ...account, gender: null, isActive: false }, { kind: 'none' });
    expect(none).not.toHaveProperty('benhnhan');
    expect(none).not.toHaveProperty('nhanvien');
    expect(none).toMatchObject({
      gioi_tinh: null,
      taikhoan: { create: { trang_thai_hoat_dong: false } },
    });
  });
});

describe('ghi khi sửa', () => {
  const birthDate = new Date('1990-05-06T00:00:00.000Z');

  it('personChangesToDb: họ tên in hoa, gender theo CSDL; vắng giữ nguyên', () => {
    expect(personChangesToDb({ full_name: ' trần b ', gender: null })).toEqual({
      ho_ten: 'TRẦN B',
      gioi_tinh: null,
    });
    expect(personChangesToDb({})).toEqual({ ho_ten: undefined, gioi_tinh: undefined });
  });

  it('profileUpdateToDb: địa chỉ và năm sinh vào nguoi, còn lại vào benhnhan; chữ được trim, rỗng → null', () => {
    const { person, patient } = profileUpdateToDb(
      {
        year_of_birth: 1991,
        career: 'Hoc sinh - Sinh vien',
        ethnic: ' Kinh ',
        hamlet_address: 'Thôn 1',
        commune_address: '  Xã A',
        city_address: 'Hà Nội',
        health_insurance_number: '',
        health_insurance_validate: '2027-03-31',
        next_of_kin_name: 'Nguyễn Văn C  ',
        next_of_kin_phone: '0987654321',
      },
      birthDate,
    );
    expect(person).toEqual({
      ho_ten: undefined,
      gioi_tinh: undefined,
      ngay_sinh: new Date('1991-01-01T00:00:00.000Z'),
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_tinh_tp: 'Hà Nội',
    });
    expect(patient).toEqual({
      nghe_nghiep: 'Hoc sinh - Sinh vien',
      dan_toc: 'Kinh',
      bhyt_so_the: null,
      bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
      nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C',
      nguoi_nha_so_dien_thoai: '0987654321',
    });
  });

  it('profileUpdateToDb: chỉ trường của nguoi → không có phần benhnhan; năm sinh trùng giữ ngày thật (MT-13)', () => {
    expect(profileUpdateToDb({ full_name: 'An', year_of_birth: 1990 }, birthDate)).toEqual({
      person: {
        ho_ten: 'AN',
        gioi_tinh: undefined,
        ngay_sinh: undefined,
        dia_chi_so_nha_thon_pho: undefined,
        dia_chi_xa_phuong: undefined,
        dia_chi_tinh_tp: undefined,
      },
    });
    expect(dateForYear(1990, birthDate)).toBeUndefined();
  });

  it('accountChangesToDb (D7): chỉ cột có giá trị khác bản ghi hiện tại', () => {
    const current = { roleId: 2, isActive: true };
    expect(accountChangesToDb({ role_id: 2, is_active: 1 }, current)).toEqual({
      ma_vai_tro: undefined,
      trang_thai_hoat_dong: undefined,
    });
    expect(accountChangesToDb({ role_id: 3, is_active: 0 }, current)).toEqual({
      ma_vai_tro: 3n,
      trang_thai_hoat_dong: false,
    });
    expect(accountChangesToDb({}, current)).toEqual({
      ma_vai_tro: undefined,
      trang_thai_hoat_dong: undefined,
    });
  });
});

describe('bản ghi miền → contract', () => {
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
  const BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };

  it('toSignupData: ID và is_active kiểu int, created_at = taikhoan.thoi_diem_tao (ISO)', () => {
    expect(toSignupData(userRecord({ gender: 'male' }))).toStrictEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      gender: 'male',
      role_id: 4,
      is_active: 1,
      created_at: '2026-11-15T01:02:03.000Z',
    });
  });

  it('toLoginUserInfo: mọi trường kiểu string (MT-06)', () => {
    expect(toLoginUserInfo(userRecord())).toStrictEqual({
      user_id: '7',
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      role_id: '4',
    });
  });

  it('toCreateStaffData: {user_id, full_name, role_id, branch_id} kiểu int', () => {
    expect(toCreateStaffData(staffUserRecord(), 10)).toStrictEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      role_id: 2,
      branch_id: 10,
    });
  });

  it('toProfileData: bệnh nhân đủ 16 khoá (không còn work_place); nhân viên 5 khoá', () => {
    expect(toProfileData(patient())).toStrictEqual({
      ...BASE,
      role_id: 4,
      ...EMPTY_PATIENT_FIELDS,
    });
    expect(toProfileData(staff())).toStrictEqual({ ...BASE, role_id: 2 });
  });

  it('toProfileData: đọc địa chỉ, năm sinh từ nguoi; ngày theo YYYY-MM-DD / ISO 8601', () => {
    const record = userRecord({
      person: {
        birthDate: new Date('1990-05-06T00:00:00.000Z'),
        hamletAddress: 'Thôn 1',
        communeAddress: 'Xã A',
        cityAddress: 'Hà Nội',
      },
      patient: patientFields({
        insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
        firstVisit: new Date('2026-11-15T08:30:00.000Z'),
      }),
    });
    expect(toProfileData(patient(record))).toMatchObject({
      year_of_birth: 1990,
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_validate: '2027-03-31',
      first_visit: '2026-11-15T08:30:00.000Z',
    });
  });

  it('toUserSummary: ID, is_active kiểu int', () => {
    expect(toUserSummary(userRecord({ isActive: false }))).toStrictEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      role_id: 4,
      is_active: 0,
    });
  });

  it('toAdminUserDetail: bệnh nhân như profile; nhân viên thêm branch_id, null khi chưa phân công', () => {
    expect(toAdminUserDetail(patient())).toStrictEqual(toProfileData(patient()));
    expect(toAdminUserDetail(staff())).toStrictEqual({ ...BASE, role_id: 2, branch_id: 10 });
    expect(toAdminUserDetail(staff(staffUserRecord({ staff: null })))).toMatchObject({
      branch_id: null,
    });
  });

  it('toAssignUserData', () => {
    expect(toAssignUserData(7, 11)).toStrictEqual({ user_id: 7, branch_id: 11 });
  });
});
