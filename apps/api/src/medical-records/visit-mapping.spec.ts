import { Prisma } from '../generated/prisma/client.js';
import type { RecordLock } from './medical-record-mapping.js';
import {
  acuteVisitColumns,
  chronicVisitColumns,
  newVisitToDb,
  startVisit,
  toDayVisit,
  toTodayVisitItem,
  toVisitData,
  toVisitRecord,
  visitChangesToDb,
  type AcuteVisitColumns,
  type ChronicVisitColumns,
  type DayVisitRow,
  type VisitColumns,
  type VisitRow,
} from './visit-mapping.js';
import {
  EMPTY_ACUTE_VISIT,
  EMPTY_CHRONIC_VISIT,
  EMPTY_VISIT_CORE,
  visitRecord,
} from './visit.fixture.js';

type AcuteVisitRow = NonNullable<
  VisitRow['phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham']
>;
type ChronicVisitRow = NonNullable<
  VisitRow['phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham']
>;

const chronicVisitRow = (overrides: Partial<ChronicVisitRow> = {}): ChronicVisitRow => ({
  ma_phien_kham: 30n,
  loai_benh_an: 'MAN',
  hien_tai_co_san_phu: true,
  uu_the_ngau_nhien: true,
  vi_tri_san_phu: 'Khap co the',
  yeu_to_lam_nang_sa_phu: 'Stress',
  hoan_canh_xuat_hien_san_phu: 'Ngẫu nhiên',
  trong_dot_co_phu_mach: true,
  hien_tai_co_phu_mach: false,
  so_lan_phu_mach_dot_nay: 3,
  hoan_canh_xuat_hien_phu_mach: 'Sau ngủ dậy',
  so_lan_phu_mach_nang_phai_nhap_vien: 0,
  thoi_gian_ton_tai_phu_mach_co_dung_thuoc: '<1h',
  thoi_gian_ton_tai_phu_mach_khong_dung_thuoc: '6-12h',
  diem_aas7: 12,
  ben_phu_mach: 'Hai bên',
  thoi_gian_ngau_nhien_tuan: new Prisma.Decimal('6.25'),
  uu_the_kich_thich: false,
  thoi_gian_kich_thich_tuan: null,
  uu_the_tuong_duong: null,
  uu_the_khong_ro: null,
  thu_tu_xuat_hien_so_voi_san_phu: 'Đồng thời',
  phu_mach_1_tuan_gan_day: true,
  chan_doan_tai_kham: 'CSU',
  khoang_cach_xuat_hien: 'Trong 3 tháng',
  phu_mi_mat: true,
  phu_luoi: false,
  phu_moi: null,
  phu_vung_mat_khac: null,
  phu_thanh_quan: false,
  phu_ban_chan: null,
  phu_sinh_duc: null,
  phu_vi_tri_khac: true,
  phu_vi_tri_khac_ghi_ro: 'Mu bàn chân',
  phu_ban_tay: null,
  ...overrides,
});

const acuteVisitRow = (overrides: Partial<AcuteVisitRow> = {}): AcuteVisitRow => ({
  ma_phien_kham: 31n,
  loai_benh_an: 'CAP',
  trieu_chung_da: 'Sẩn phù toàn thân',
  trieu_chung_ho_hap: null,
  so_voi_thuong_ngay_ho_hap: null,
  trieu_chung_tuan_hoan: null,
  so_voi_thuong_ngay_tuan_hoan: null,
  trieu_chung_tieu_hoa: 'Đau bụng',
  so_voi_thuong_ngay_tieu_hoa: 'Nặng hơn',
  co_san_phu: true,
  co_anh_san_phu: false,
  so_lan_non: 0,
  ...overrides,
});

const visitRow = (overrides: Partial<VisitRow> = {}): VisitRow => ({
  ma_phien_kham: 30n,
  ma_ho_so: 12n,
  ma_bac_si: 5n,
  ma_phong_kham: 2n,
  loai_benh_an: 'MAN',
  ma_subtype_cap: null,
  ma_subtype_man: 30n,
  ngay_kham: new Date('2026-11-15T00:00:00.000Z'),
  lan_kham_thu: 1,
  loai_phien_kham: 'Tái khám',
  luu_huyet_thanh: false,
  sot: true,
  sot_nhiet_do_c: new Prisma.Decimal('38.5'),
  ngay_hen_tai_kham: new Date('2026-12-13T00:00:00.000Z'),
  tom_tat_buoi_kham: 'Đỡ ngứa',
  huong_xu_tri_lan_sau: 'Giảm liều',
  dan_do: 'Uống thuốc đều',
  nhanvien: { nguoi: { ho_ten: 'NGUYỄN VĂN AN' } },
  phongkham: { ten_phong_kham: 'Phòng 101' },
  phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham: null,
  phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham: chronicVisitRow(),
  ...overrides,
});

/** Hồ sơ CAP 12 vừa khoá, chưa có phiên. */
const LOCK: RecordLock = {
  id: 12,
  patientId: 7,
  type: 'CAP',
  status: 'pending',
  assignedDoctorId: null,
  latestVisitId: null,
  maxVisitNumber: 0,
};

describe('visit-mapping: hàng CSDL → bản ghi miền', () => {
  it('toVisitRecord (MAN): bigint → number, DATE → YYYY-MM-DD, NUMERIC → number, tên bác sĩ, tên phòng; acute null', () => {
    expect(toVisitRecord(visitRow())).toEqual({
      id: 30,
      recordId: 12,
      type: 'MAN',
      number: 1,
      date: '2026-11-15',
      doctorId: 5,
      doctorName: 'NGUYỄN VĂN AN',
      roomId: 2,
      roomName: 'Phòng 101',
      nextAppointmentDate: '2026-12-13',
      instructions: 'Uống thuốc đều',
      core: {
        visit_kind: 'Tái khám',
        serum_stored: false,
        fever: true,
        fever_temperature_c: 38.5,
        visit_summary: 'Đỡ ngứa',
        next_plan: 'Giảm liều',
      },
      acute: null,
      chronic: {
        wheals_now: true,
        wheal_trigger_context: 'Ngẫu nhiên',
        dominant_spontaneous: true,
        spontaneous_weeks: 6.25,
        dominant_induced: false,
        induced_weeks: null,
        dominant_equal: null,
        dominant_unknown: null,
        wheal_location: 'Khap co the',
        wheal_aggravating_factor: 'Stress',
        angioedema_this_episode: true,
        angioedema_now: false,
        angioedema_trigger_context: 'Sau ngủ dậy',
        angioedema_count: 3,
        angioedema_hospitalizations: 0,
        angioedema_duration_with_meds: '<1h',
        angioedema_duration_without_meds: '6-12h',
        aas7_score: 12,
        angioedema_side: 'Hai bên',
        angioedema_order_vs_wheals: 'Đồng thời',
        angioedema_interval: 'Trong 3 tháng',
        angioedema_last_week: true,
        follow_up_diagnosis: 'CSU',
        angioedema_eyelid: true,
        angioedema_tongue: false,
        angioedema_lip: null,
        angioedema_face_other: null,
        angioedema_larynx: false,
        angioedema_hand: null,
        angioedema_foot: null,
        angioedema_genital: null,
        angioedema_other_site: true,
        angioedema_other_site_detail: 'Mu bàn chân',
      },
    });
  });

  it('toVisitRecord (CAP, chưa phân phòng — MT-115): roomId, roomName null; acute đủ 10 trường; chronic null', () => {
    const record = toVisitRecord(
      visitRow({
        ma_phien_kham: 31n,
        loai_benh_an: 'CAP',
        ma_subtype_cap: 31n,
        ma_subtype_man: null,
        ma_phong_kham: null,
        phongkham: null,
        ngay_hen_tai_kham: null,
        sot_nhiet_do_c: null,
        phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham: acuteVisitRow(),
        phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham: null,
      }),
    );
    expect(record).toMatchObject({
      id: 31,
      type: 'CAP',
      roomId: null,
      roomName: null,
      nextAppointmentDate: null,
      chronic: null,
      acute: {
        skin_symptoms: 'Sẩn phù toàn thân',
        respiratory_symptoms: null,
        respiratory_vs_usual: null,
        circulatory_symptoms: null,
        circulatory_vs_usual: null,
        digestive_symptoms: 'Đau bụng',
        digestive_vs_usual: 'Nặng hơn',
        has_wheals: true,
        has_wheal_photo: false,
        vomiting_count: 0,
      },
    });
    expect(record.core.fever_temperature_c).toBeNull();
    expect(Object.keys(record.acute!)).toHaveLength(10);
  });

  it('loai_benh_an ngoài CHECK → lỗi (không thể xảy ra vì có ck_phienkham_loai)', () => {
    expect(() => toVisitRecord(visitRow({ loai_benh_an: 'XYZ' }))).toThrow(/loai_benh_an/);
  });
});

describe('visit-mapping: bản ghi miền → cột ghi', () => {
  it('kiểu cột ghi loại identity và cột generated (spec A, mục 4.7; spike 3f: ghi vào là 428C9)', () => {
    expectTypeOf<VisitColumns>().not.toHaveProperty('ma_phien_kham');
    expectTypeOf<VisitColumns>().not.toHaveProperty('ma_subtype_cap');
    expectTypeOf<VisitColumns>().not.toHaveProperty('ma_subtype_man');
    expectTypeOf<AcuteVisitColumns>().not.toHaveProperty('loai_benh_an');
    expectTypeOf<ChronicVisitColumns>().not.toHaveProperty('loai_benh_an');
  });

  it('startVisit: lan_kham_thu = MAX + 1 của hồ sơ đã khoá, loại theo hồ sơ; chỉ có khoá và cột của VisitStart (spec B, mục 6.2)', () => {
    expect(
      startVisit({ ...LOCK, maxVisitNumber: 2 }, { doctorId: 5, roomId: null, date: '2026-11-16' }),
    ).toEqual({
      recordId: 12,
      type: 'CAP',
      number: 3,
      doctorId: 5,
      roomId: null,
      date: '2026-11-16',
      nextAppointmentDate: null,
      instructions: null,
      core: {},
      acute: {},
      chronic: {},
    });
  });

  it('newVisitToDb: khoá, loại, bác sĩ, phòng, ngày khám, số lần; cột lâm sàng vắng = không ghi', () => {
    expect(newVisitToDb(startVisit(LOCK, { doctorId: 5, roomId: 2, date: '2026-11-16' }))).toEqual({
      ma_ho_so: 12n,
      loai_benh_an: 'CAP',
      ma_bac_si: 5n,
      ma_phong_kham: 2n,
      ngay_kham: new Date('2026-11-16T00:00:00.000Z'),
      lan_kham_thu: 1,
      ngay_hen_tai_kham: null,
      dan_do: null,
      loai_phien_kham: undefined,
      luu_huyet_thanh: undefined,
      sot: undefined,
      sot_nhiet_do_c: undefined,
      tom_tat_buoi_kham: undefined,
      huong_xu_tri_lan_sau: undefined,
    });
  });

  it('visitChangesToDb: chỉ khoá có mặt; null = xoá; không có ma_bac_si, lan_kham_thu, ma_ho_so', () => {
    const data = visitChangesToDb({
      date: '2026-11-20',
      roomId: null,
      nextAppointmentDate: '2026-12-18',
      instructions: null,
      core: { fever_temperature_c: 37.5 },
    });
    expect(Object.entries(data).filter(([, value]) => value !== undefined)).toEqual([
      ['ngay_kham', new Date('2026-11-20T00:00:00.000Z')],
      ['ma_phong_kham', null],
      ['ngay_hen_tai_kham', new Date('2026-12-18T00:00:00.000Z')],
      ['dan_do', null],
      ['sot_nhiet_do_c', 37.5],
    ]);
    const keys = Object.keys(visitChangesToDb({}));
    expect(keys).not.toContain('ma_bac_si');
    expect(keys).not.toContain('lan_kham_thu');
    expect(keys).not.toContain('ma_ho_so');
  });

  it('acuteVisitColumns, chronicVisitColumns: đủ cột của subtype; vắng = không ghi', () => {
    expect(Object.keys(acuteVisitColumns({}))).toHaveLength(10);
    expect(Object.keys(chronicVisitColumns({}))).toHaveLength(33);
    expect(
      Object.entries(
        chronicVisitColumns({
          aas7_score: 12,
          angioedema_other_site: false,
          angioedema_other_site_detail: null,
        }),
      ).filter(([, value]) => value !== undefined),
    ).toEqual([
      ['diem_aas7', 12],
      ['phu_vi_tri_khac', false],
      ['phu_vi_tri_khac_ghi_ro', null],
    ]);
    expect(
      Object.entries(acuteVisitColumns({ has_wheals: true, vomiting_count: 0 })).filter(
        ([, value]) => value !== undefined,
      ),
    ).toEqual([
      ['co_san_phu', true],
      ['so_lan_non', 0],
    ]);
  });
});

describe('visit-mapping: bản ghi miền → contract', () => {
  it('toVisitData nhân viên: đúng 11 khoá theo thứ tự contract, details = lõi + acute + chronic', () => {
    const data = toVisitData(visitRecord(), 'staff');
    expect(Object.keys(data)).toEqual([
      'visit_id',
      'medical_record_id',
      'visit_number',
      'visit_date',
      'doctor_id',
      'doctor_name',
      'room_id',
      'room_name',
      'next_appointment_date',
      'instructions',
      'details',
    ]);
    expect(data).toEqual({
      visit_id: 30,
      medical_record_id: 12,
      visit_number: 1,
      visit_date: '2026-11-15',
      doctor_id: 5,
      doctor_name: 'NGUYỄN VĂN AN',
      room_id: 2,
      room_name: 'Phòng 101',
      next_appointment_date: null,
      instructions: null,
      details: { ...EMPTY_VISIT_CORE, acute: null, chronic: EMPTY_CHRONIC_VISIT },
    });
  });

  it('toVisitData bệnh nhân: details null (không có tóm tắt buổi khám, hướng xử trí, trường lâm sàng; D-B21, MT-126); vẫn có ngày, phòng, hẹn, dặn dò', () => {
    const data = toVisitData(
      visitRecord({
        nextAppointmentDate: '2026-12-13',
        instructions: 'Uống thuốc đều',
        core: { ...EMPTY_VISIT_CORE, visit_summary: 'Ghi chú nội bộ' },
      }),
      'patient',
    );
    expect(data).toMatchObject({
      room_name: 'Phòng 101',
      next_appointment_date: '2026-12-13',
      instructions: 'Uống thuốc đều',
      details: null,
    });
    expect(JSON.stringify(data)).not.toContain('Ghi chú nội bộ');
  });

  it('fixture: khối rỗng dựng từ bộ mô tả có đủ khoá của contract', () => {
    expect(Object.keys(EMPTY_ACUTE_VISIT)).toHaveLength(10);
    expect(Object.keys(EMPTY_CHRONIC_VISIT)).toHaveLength(33);
    expect(Object.values(EMPTY_CHRONIC_VISIT).every((value) => value === null)).toBe(true);
  });
});

/** Phiên 31 (lần 2) của hồ sơ MAN 12 đang khám: bệnh nhân LÊ THỊ MAI, bác sĩ NGUYỄN VĂN AN, phòng 101. */
const dayVisitRow = (overrides: Partial<DayVisitRow> = {}): DayVisitRow => ({
  ma_phien_kham: 31n,
  ma_ho_so: 12n,
  lan_kham_thu: 2,
  loai_benh_an: 'MAN',
  nhanvien: { nguoi: { ho_ten: 'NGUYỄN VĂN AN' } },
  phongkham: { ten_phong_kham: 'Phòng 101' },
  hosobenhan: { trang_thai: 'in_progress', benhnhan: { nguoi: { ho_ten: 'LÊ THỊ MAI' } } },
  ...overrides,
});

describe('visit-mapping: phiên trong ngày (Tổng quan, spec B mục 5.5)', () => {
  it('toDayVisit: bigint → number, loại và trạng thái hồ sơ, tên bệnh nhân, bác sĩ, phòng', () => {
    expect(toDayVisit(dayVisitRow())).toEqual({
      id: 31,
      recordId: 12,
      number: 2,
      recordType: 'MAN',
      recordStatus: 'in_progress',
      patientName: 'LÊ THỊ MAI',
      doctorName: 'NGUYỄN VĂN AN',
      roomName: 'Phòng 101',
    });
  });

  it('chưa phân phòng (MT-115) → roomName null; trạng thái hồ sơ ngoài CHECK → lỗi', () => {
    expect(toDayVisit(dayVisitRow({ phongkham: null })).roomName).toBeNull();
    expect(() =>
      toDayVisit(
        dayVisitRow({ hosobenhan: { trang_thai: 'mo', benhnhan: { nguoi: { ho_ten: 'X' } } } }),
      ),
    ).toThrow(/trang_thai/);
  });

  it('toTodayVisitItem: đúng 8 khoá của TodayVisitItem theo thứ tự contract', () => {
    const item = toTodayVisitItem(
      toDayVisit(dayVisitRow({ loai_benh_an: 'CAP', phongkham: null })),
    );
    expect(Object.keys(item)).toEqual([
      'visit_id',
      'medical_record_id',
      'visit_number',
      'record_type',
      'record_status',
      'patient_name',
      'doctor_name',
      'room_name',
    ]);
    expect(item).toEqual({
      visit_id: 31,
      medical_record_id: 12,
      visit_number: 2,
      record_type: 'CAP',
      record_status: 'in_progress',
      patient_name: 'LÊ THỊ MAI',
      doctor_name: 'NGUYỄN VĂN AN',
      room_name: null,
    });
  });
});
