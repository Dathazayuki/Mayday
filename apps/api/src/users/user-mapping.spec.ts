import type { Career, Gender } from '@drmayday/shared';
import type { patients_nghe_nghiep, users_gioi_tinh } from '../generated/prisma/client.js';
import {
  careerFromDb,
  careerToDb,
  dateForYear,
  genderFromDb,
  genderToDb,
  isoDate,
  isoDateTime,
  normalizeFullName,
  roleIdOf,
  yearFromDate,
} from './user-mapping.js';
import type { UserRecord } from './users.repository.js';

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
