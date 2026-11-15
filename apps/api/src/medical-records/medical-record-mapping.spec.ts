import { Prisma } from '../generated/prisma/client.js';
import {
  NO_VISITS,
  acuteColumns,
  acuteIntervals,
  chronicColumns,
  newRecordToDb,
  recordChangesToDb,
  toMedicalRecord,
  toMedicalRecordData,
  toMedicalRecordHistoryItem,
  toMedicalRecordListItem,
  toMedicalRecordSummary,
  toRecordLock,
  toRecordOverview,
  toStatusCounts,
  type AcuteColumns,
  type ChronicColumns,
  type RecordColumns,
  type RecordDetailRow,
  type RecordOverviewRow,
} from './medical-record-mapping.js';

const overviewRow = (overrides: Partial<RecordOverviewRow> = {}): RecordOverviewRow => ({
  ma_ho_so: 12n,
  ma_benh_nhan: 7n,
  loai_benh_an: 'MAN',
  trang_thai: 'in_progress',
  thoi_diem_kham_lan_dau: new Date('2026-11-15T01:00:00.000Z'),
  ho_ten: 'LÊ THỊ MAI',
  so_dien_thoai: '0911111111',
  ma_bac_si_phu_trach: 5n,
  ten_bac_si_phu_trach: 'NGUYỄN VĂN AN',
  so_phien: 2n,
  ngay_kham_gan_nhat: new Date('2026-11-20T00:00:00.000Z'),
  ngay_hen_tai_kham: new Date('2026-12-18T00:00:00.000Z'),
  dan_do: 'Uống thuốc đều',
  ...overrides,
});

type AcuteRow = NonNullable<
  RecordDetailRow['benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan']
>;
type ChronicRow = NonNullable<
  RecordDetailRow['benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan']
>;

const chronicRow = (overrides: Partial<ChronicRow> = {}): ChronicRow => ({
  ma_ho_so: 12n,
  loai_benh_an: 'MAN',
  chan_doan_chinh: 'CSU',
  phan_nhom_csu: 'CSU Type I',
  chung_da_ve_noi: true,
  may_day_cholinergic: null,
  may_day_do_lanh: false,
  may_day_adrenergic: null,
  may_day_do_nuoc: null,
  may_day_do_anh_sang: null,
  may_day_cam_ung_khac: true,
  may_day_cam_ung_khac_ghi_ro: 'Do nóng',
  bieu_hien_qua_trinh_benh: 'San phu + phu mach',
  ...overrides,
});

const acuteRow = (overrides: Partial<AcuteRow> = {}): AcuteRow => ({
  ma_ho_so: 13n,
  loai_benh_an: 'CAP',
  nhap_vien: false,
  cd_soc_phan_ve: null,
  cd_phan_ve: null,
  cd_may_day_cap_nang: null,
  cd_may_day_cap_thong_thuong: true,
  tien_su_benh_nen_da: 'Viêm da cơ địa',
  tien_su_benh_nen_ho_hap: null,
  tien_su_benh_nen_tuan_hoan: null,
  tien_su_benh_tim_mach_ghi_ro: null,
  tien_su_benh_tieu_hoa_man_tinh_ghi_ro: null,
  tien_su_benh_nen_tieu_hoa: null,
  nhom_yeu_to_nghi_ngo: 'Thuc an',
  co_nghi_ngo_dot_nay: true,
  ten_yeu_to_nghi_ngo: 'Tôm',
  loai_tien_su: null,
  da_tung_phan_ung_truoc_day: null,
  tien_su_phan_ve_ghi_ro: null,
  tien_su_di_ung_ghi_ro: null,
  da_dieu_tri_benh_dot_nay: null,
  tuoi_lan_dau_bi_benh: 25,
  so_lan_may_day_cap_truoc: 0,
  thoi_diem_cap_nhat: new Date('2026-11-15T02:00:00.000Z'),
  benh_phu: null,
  ...overrides,
});

const detailRow = (overrides: Partial<RecordDetailRow> = {}): RecordDetailRow => ({
  ma_ho_so: 12n,
  ma_benh_nhan: 7n,
  loai_benh_an: 'MAN',
  ma_subtype_cap: null,
  ma_subtype_man: 12n,
  thoi_diem_kham_lan_dau: new Date('2026-11-15T01:00:00.000Z'),
  ngay_bat_dau_dieu_tri_ngoai_tru: new Date('2026-11-01T00:00:00.000Z'),
  ngay_ket_thuc_dieu_tri_ngoai_tru: null,
  chan_doan_tuyen_truoc: 'Mày đay',
  chan_doan_ban_dau_phong_kham: null,
  ket_qua_dieu_tri_bao_hiem: 'Do',
  thoi_gian_khoi_phat_tuan: new Prisma.Decimal('10.5'),
  trang_thai: 'in_progress',
  tien_su_gia_dinh: 'Co',
  tien_su_gia_dinh_ghi_ro: 'Mẹ bị mày đay mạn',
  da_dieu_tri_truoc_kham: null,
  benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan: null,
  benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan: chronicRow(),
  ...overrides,
});

describe('medical-record-mapping: hàng CSDL → bản ghi miền', () => {
  it('toRecordOverview: bigint → number, trường suy ra của phiên đầu/cuối (D-B6, D-B8)', () => {
    expect(toRecordOverview(overviewRow())).toEqual({
      id: 12,
      patientId: 7,
      type: 'MAN',
      status: 'in_progress',
      firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
      summary: {
        patientName: 'LÊ THỊ MAI',
        patientPhone: '0911111111',
        assignedDoctorId: 5,
        assignedDoctorName: 'NGUYỄN VĂN AN',
        visitCount: 2,
        lastVisitDate: new Date('2026-11-20T00:00:00.000Z'),
        nextAppointmentDate: new Date('2026-12-18T00:00:00.000Z'),
        latestInstructions: 'Uống thuốc đều',
      },
    });
  });

  it('chưa có phiên: bác sĩ phụ trách null, số phiên 0', () => {
    const overview = toRecordOverview(
      overviewRow({
        ma_bac_si_phu_trach: null,
        ten_bac_si_phu_trach: null,
        so_phien: 0n,
        ngay_kham_gan_nhat: null,
        ngay_hen_tai_kham: null,
        dan_do: null,
        thoi_diem_kham_lan_dau: null,
      }),
    );
    expect(overview).toMatchObject({
      firstVisitAt: null,
      summary: {
        assignedDoctorId: null,
        assignedDoctorName: null,
        visitCount: 0,
        lastVisitDate: null,
      },
    });
  });

  it('giá trị ngoài CHECK (không thể xảy ra) → lỗi, không trả kiểu sai', () => {
    expect(() => toRecordOverview(overviewRow({ trang_thai: 'archived' }))).toThrow(/trang_thai/);
  });

  it('toMedicalRecord MAN: self_report lấy biểu hiện bệnh từ benhanmaydayman; Decimal → number; DATE → YYYY-MM-DD', () => {
    const record = toMedicalRecord(toRecordOverview(overviewRow()), detailRow(), null);
    expect(record.selfReport).toEqual({
      referral_diagnosis: 'Mày đay',
      initial_clinic_diagnosis: null,
      onset_weeks: 10.5,
      disease_manifestation: 'San phu + phu mach',
    });
    expect(record.core).toEqual({
      outpatient_start_date: '2026-11-01',
      outpatient_end_date: null,
      insurance_treatment_result: 'Do',
      family_history: 'Co',
      family_history_detail: 'Mẹ bị mày đay mạn',
      treated_before_visit: null,
    });
    expect(record.chronic).toEqual({
      main_diagnosis: 'CSU',
      csu_subtype: 'CSU Type I',
      cindu_dermographism: true,
      cindu_cholinergic: null,
      cindu_cold: false,
      cindu_adrenergic: null,
      cindu_aquagenic: null,
      cindu_solar: null,
      cindu_other: true,
      cindu_other_detail: 'Do nóng',
    });
    expect(record.acute).toBeNull();
  });

  it('toMedicalRecord CAP: INTERVAL đọc bằng số giây; updated_at ISO; biểu hiện bệnh luôn null', () => {
    const overview = toRecordOverview(overviewRow({ ma_ho_so: 13n, loai_benh_an: 'CAP' }));
    const row = detailRow({
      ma_ho_so: 13n,
      loai_benh_an: 'CAP',
      ma_subtype_cap: 13n,
      ma_subtype_man: null,
      thoi_gian_khoi_phat_tuan: null,
      benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan: acuteRow(),
      benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan: null,
    });
    const record = toMedicalRecord(overview, row, {
      thoi_gian_tiep_xuc_den_khoi_phat: 1800,
      thoi_gian_keo_dai_tb: null,
      dot_gan_nhat_cach: 86_400,
    });
    expect(record.selfReport.disease_manifestation).toBeNull();
    expect(record.chronic).toBeNull();
    expect(record.acute).toMatchObject({
      hospitalized: false,
      dx_common_acute_urticaria: true,
      comorbidity_skin: 'Viêm da cơ địa',
      suspected_trigger_group: 'Thuc an',
      suspected_this_episode: true,
      suspected_trigger_name: 'Tôm',
      exposure_to_onset_seconds: 1800,
      mean_duration_seconds: null,
      last_episode_ago_seconds: 86_400,
      first_onset_age: 25,
      prior_acute_episodes: 0,
      secondary_disease: null,
      updated_at: '2026-11-15T02:00:00.000Z',
    });
    expect(Object.keys(record.acute!)).toHaveLength(26);
  });

  it('toRecordLock: chưa có phiên → maxVisitNumber 0 (phiên đầu là 1), không có phiên mới nhất', () => {
    const row = { ma_ho_so: 12n, ma_benh_nhan: 7n, loai_benh_an: 'MAN', trang_thai: 'pending' };
    expect(toRecordLock(row, NO_VISITS)).toEqual({
      id: 12,
      patientId: 7,
      type: 'MAN',
      status: 'pending',
      assignedDoctorId: null,
      latestVisitId: null,
      maxVisitNumber: 0,
    });
    expect(
      toRecordLock(row, { ma_bac_si_phu_trach: 5n, ma_phien_cuoi: 31n, lan_kham_lon_nhat: 3 }),
    ).toMatchObject({ assignedDoctorId: 5, latestVisitId: 31, maxVisitNumber: 3 });
  });

  it('toStatusCounts: đủ 5 trạng thái, 0 khi không có dòng; COUNT bigint → number', () => {
    expect(
      toStatusCounts([
        { trang_thai: 'pending', total: 2n },
        { trang_thai: 'completed', total: 1n },
      ]),
    ).toEqual({ draft: 0, pending: 2, in_progress: 0, completed: 1, cancelled: 0 });
  });
});

describe('medical-record-mapping: bản ghi miền → cột ghi', () => {
  it('kiểu cột ghi loại cột generated (spec A, mục 4.7; spike 3f: ghi vào là 428C9)', () => {
    expectTypeOf<RecordColumns>().not.toHaveProperty('ma_subtype_cap');
    expectTypeOf<RecordColumns>().not.toHaveProperty('ma_subtype_man');
    expectTypeOf<RecordColumns>().not.toHaveProperty('ma_ho_so');
    expectTypeOf<AcuteColumns>().not.toHaveProperty('loai_benh_an');
    expectTypeOf<AcuteColumns>().not.toHaveProperty('thoi_diem_cap_nhat');
    expectTypeOf<ChronicColumns>().not.toHaveProperty('loai_benh_an');
  });

  it('newRecordToDb: khoá, loại, trạng thái, thời điểm khám lần đầu, cột lõi và self_report; vắng = không ghi', () => {
    expect(
      newRecordToDb({
        patientId: 7,
        type: 'MAN',
        status: 'pending',
        firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
        selfReport: {
          referral_diagnosis: 'Mày đay',
          onset_weeks: 10,
          disease_manifestation: 'Chi phu mach',
        },
        core: { outpatient_start_date: '2026-11-01', family_history: 'Khong' },
        acute: {},
        chronic: {},
      }),
    ).toEqual({
      ma_benh_nhan: 7n,
      loai_benh_an: 'MAN',
      trang_thai: 'pending',
      thoi_diem_kham_lan_dau: new Date('2026-11-15T01:00:00.000Z'),
      chan_doan_tuyen_truoc: 'Mày đay',
      chan_doan_ban_dau_phong_kham: undefined,
      thoi_gian_khoi_phat_tuan: 10,
      ngay_bat_dau_dieu_tri_ngoai_tru: new Date('2026-11-01T00:00:00.000Z'),
      ngay_ket_thuc_dieu_tri_ngoai_tru: undefined,
      ket_qua_dieu_tri_bao_hiem: undefined,
      tien_su_gia_dinh: 'Khong',
      tien_su_gia_dinh_ghi_ro: undefined,
      da_dieu_tri_truoc_kham: undefined,
    });
  });

  it('recordChangesToDb: chỉ khoá có mặt; null = xoá; không có trang_thai, loai_benh_an, ma_benh_nhan', () => {
    const data = recordChangesToDb({
      firstVisitAt: null,
      selfReport: { onset_weeks: null },
      core: { outpatient_end_date: '2026-11-30' },
    });
    expect(Object.entries(data).filter(([, value]) => value !== undefined)).toEqual([
      ['thoi_diem_kham_lan_dau', null],
      ['thoi_gian_khoi_phat_tuan', null],
      ['ngay_ket_thuc_dieu_tri_ngoai_tru', new Date('2026-11-30T00:00:00.000Z')],
    ]);
    expect(Object.keys(recordChangesToDb({}))).not.toContain('trang_thai');
  });

  it('acuteColumns không có cột INTERVAL (Prisma không ghi được, spike 3e); acuteIntervals tách riêng 3 trường giây', () => {
    const fields = {
      hospitalized: true,
      exposure_to_onset_seconds: 600,
      last_episode_ago_seconds: null,
    };
    const columns = acuteColumns(fields);
    expect(Object.entries(columns).filter(([, value]) => value !== undefined)).toEqual([
      ['nhap_vien', true],
    ]);
    expect(Object.keys(columns)).toHaveLength(22);
    expect(acuteIntervals(fields)).toEqual({
      exposure_to_onset_seconds: 600,
      mean_duration_seconds: undefined,
      last_episode_ago_seconds: null,
    });
  });

  it('chronicColumns ghi cả biểu hiện bệnh của self_report vào benhanmaydayman', () => {
    const columns = chronicColumns({ cindu_other: false, cindu_other_detail: null }, 'Chi san phu');
    expect(Object.entries(columns).filter(([, value]) => value !== undefined)).toEqual([
      ['may_day_cam_ung_khac', false],
      ['may_day_cam_ung_khac_ghi_ro', null],
      ['bieu_hien_qua_trinh_benh', 'Chi san phu'],
    ]);
    expect(Object.keys(columns)).toHaveLength(11);
  });
});

describe('medical-record-mapping: bản ghi miền → contract', () => {
  const record = toMedicalRecord(toRecordOverview(overviewRow()), detailRow(), null);

  it('toMedicalRecordListItem: đúng 13 khoá theo thứ tự của contract; DATE → YYYY-MM-DD, TIMESTAMPTZ → ISO', () => {
    const item = toMedicalRecordListItem(record, ['edit']);
    expect(item).toEqual({
      medical_record_id: 12,
      patient_id: 7,
      patient_name: 'LÊ THỊ MAI',
      patient_phone: '0911111111',
      record_type: 'MAN',
      status: 'in_progress',
      assigned_doctor_id: 5,
      assigned_doctor_name: 'NGUYỄN VĂN AN',
      first_visit_at: '2026-11-15T01:00:00.000Z',
      visit_count: 2,
      last_visit_date: '2026-11-20',
      next_appointment_date: '2026-12-18',
      allowed_actions: ['edit'],
    });
    expect(Object.keys(item)).toHaveLength(13);
  });

  it('toMedicalRecordData nhân viên: instructions = dặn dò của phiên mới nhất (D-B8), details đủ lõi + acute + chronic', () => {
    const data = toMedicalRecordData(record, [], 'staff');
    expect(data).toMatchObject({
      instructions: 'Uống thuốc đều',
      self_report: record.selfReport,
      details: { ...record.core, acute: null, chronic: record.chronic },
    });
    expect(Object.keys(data).slice(13)).toEqual(['instructions', 'self_report', 'details']);
  });

  it('toMedicalRecordData bệnh nhân: giữ self_report (kể cả giá trị bác sĩ đã sửa), details null (D-B21, MT-126)', () => {
    const data = toMedicalRecordData(record, [], 'patient');
    expect(data.details).toBeNull();
    expect(data.self_report).toEqual(record.selfReport);
  });

  it('toMedicalRecordSummary (medrec06) và toMedicalRecordHistoryItem (medrec13)', () => {
    expect(toMedicalRecordSummary(record)).toEqual({
      medical_record_id: 12,
      status: 'in_progress',
      record_type: 'MAN',
      patient_name: 'LÊ THỊ MAI',
      first_visit_at: '2026-11-15T01:00:00.000Z',
    });
    expect(toMedicalRecordHistoryItem(record)).toEqual({
      medical_record_id: 12,
      record_type: 'MAN',
      status: 'in_progress',
      instructions: 'Uống thuốc đều',
      first_visit_at: '2026-11-15T01:00:00.000Z',
      last_visit_date: '2026-11-20',
    });
  });
});
