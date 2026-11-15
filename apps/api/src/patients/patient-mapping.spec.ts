import {
  newPatientToDb,
  toPatientData,
  toPatientRecord,
  toPatientSearchItem,
  toPatientSearchRecord,
  type PatientRow,
  type PatientSearchRow,
} from './patient-mapping.js';
import { patientRecord } from './patient-record.fixture.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/** Hàng benhnhan kèm include của repository (PATIENT_INCLUDE): có tài khoản và một hồ sơ. */
function patientRow(): PatientRow {
  return {
    ma_benh_nhan: 7n,
    ma_his: null,
    nghe_nghiep: 'Cong nhan',
    dan_toc: 'Kinh',
    bhyt_so_the: 'HS4010123456789',
    bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
    nguoi_nha_ho_ten_dia_chi: 'Lê Văn B, Thôn 1',
    nguoi_nha_so_dien_thoai: '0987654321',
    hosobenhan: [{ thoi_diem_kham_lan_dau: new Date('2026-11-15T08:30:00.000Z') }],
    nguoi: {
      ma_nguoi: 7n,
      ho_ten: 'LÊ THỊ MAI',
      ngay_sinh: new Date('1990-05-06T00:00:00.000Z'),
      gioi_tinh: 'Nu',
      so_dien_thoai: '0911111111',
      dia_chi_tinh_tp: 'Hà Nội',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      thoi_diem_tao: CREATED_AT,
      thoi_diem_cap_nhat: CREATED_AT,
      taikhoan: { ma_tai_khoan: 70n, ma_vai_tro: 4n },
    },
  };
}

describe('hàng CSDL → bản ghi miền (spec B, mục 3.1, 4.2)', () => {
  it('toPatientRecord: id bigint → number; tài khoản; createdAt = nguoi.thoi_diem_tao; first visit (D14)', () => {
    expect(toPatientRecord(patientRow())).toEqual({
      id: 7,
      fullName: 'LÊ THỊ MAI',
      phone: '0911111111',
      gender: 'female',
      person: {
        birthDate: new Date('1990-05-06T00:00:00.000Z'),
        hamletAddress: 'Thôn 1',
        communeAddress: 'Xã A',
        cityAddress: 'Hà Nội',
      },
      patient: {
        career: 'Cong nhan',
        ethnic: 'Kinh',
        insuranceNumber: 'HS4010123456789',
        insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
        nextOfKinName: 'Lê Văn B, Thôn 1',
        nextOfKinPhone: '0987654321',
        firstVisit: new Date('2026-11-15T08:30:00.000Z'),
      },
      account: { accountId: 70, roleId: 4 },
      createdAt: CREATED_AT,
    });
  });

  it('không có taikhoan (dữ liệu ngoài B, D-B16) → account null; chưa có hồ sơ → firstVisit null', () => {
    const row = patientRow();
    row.nguoi.taikhoan = null;
    row.hosobenhan = [];
    expect(toPatientRecord(row)).toMatchObject({ account: null, patient: { firstVisit: null } });
  });

  it('toPatientSearchRecord: hàng SQL thô (D-B17) → bản ghi miền', () => {
    const row: PatientSearchRow = {
      ma_nguoi: 8n,
      ho_ten: 'TRẦN VĂN BÌNH',
      so_dien_thoai: '0922222222',
      gioi_tinh: 'Nam',
      ngay_sinh: null,
      co_tai_khoan: false,
    };
    expect(toPatientSearchRecord(row)).toEqual({
      id: 8,
      fullName: 'TRẦN VĂN BÌNH',
      phone: '0922222222',
      gender: 'male',
      birthDate: null,
      hasAccount: false,
    });
  });
});

describe('bản ghi miền → contract (spec B, mục 5.2)', () => {
  it('toPatientData: ProfileBase + trường hồ sơ + has_account + created_at ISO 8601', () => {
    expect(toPatientData(toPatientRecord(patientRow()))).toStrictEqual({
      user_id: 7,
      full_name: 'LÊ THỊ MAI',
      phone: '0911111111',
      role_id: 4,
      gender: 'female',
      year_of_birth: 1990,
      career: 'Cong nhan',
      ethnic: 'Kinh',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Lê Văn B, Thôn 1',
      next_of_kin_phone: '0987654321',
      first_visit: '2026-11-15T08:30:00.000Z',
      has_account: true,
      created_at: '2026-11-15T01:02:03.000Z',
    });
  });

  it('không có tài khoản → role_id null, has_account false (D-B16)', () => {
    expect(toPatientData(patientRecord({ account: null }))).toMatchObject({
      role_id: null,
      has_account: false,
    });
  });

  it('toPatientSearchItem: năm sinh từ ngày sinh; chưa có ngày sinh → null', () => {
    const record = {
      id: 7,
      fullName: 'LÊ THỊ MAI',
      phone: '0911111111',
      gender: 'female' as const,
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      hasAccount: true,
    };
    expect(toPatientSearchItem(record)).toStrictEqual({
      user_id: 7,
      full_name: 'LÊ THỊ MAI',
      phone: '0911111111',
      gender: 'female',
      year_of_birth: 1990,
      has_account: true,
    });
    expect(toPatientSearchItem({ ...record, birthDate: null }).year_of_birth).toBeNull();
  });
});

describe('bệnh nhân mới → input của Prisma (D-B16, MT-119)', () => {
  it('một nested create: họ tên in hoa, năm sinh YYYY-01-01, địa chỉ, benhnhan có trường hồ sơ, taikhoan vai trò benh_nhan; không gửi thoi_diem_*', () => {
    const data = newPatientToDb(
      {
        fullName: '  lê thị mai ',
        phone: '0911111111',
        passwordHash: 'hash',
        gender: 'female',
        roleId: 4,
      },
      {
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: ' Kinh ',
        hamlet_address: '',
        health_insurance_validate: '2027-03-31',
        next_of_kin_phone: null,
      },
    );
    expect(data).toEqual({
      ho_ten: 'LÊ THỊ MAI',
      so_dien_thoai: '0911111111',
      gioi_tinh: 'Nu',
      ngay_sinh: new Date('1990-01-01T00:00:00.000Z'),
      dia_chi_so_nha_thon_pho: null,
      taikhoan: {
        create: {
          ten_dang_nhap: '0911111111',
          mat_khau_ma_hoa: 'hash',
          trang_thai_hoat_dong: true,
          ma_vai_tro: 4n,
        },
      },
      benhnhan: {
        create: {
          nghe_nghiep: 'Cong nhan',
          dan_toc: 'Kinh',
          bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
          nguoi_nha_so_dien_thoai: null,
        },
      },
    });
  });
});
