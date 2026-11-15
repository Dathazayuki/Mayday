import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto.js';
import { EMPTY_CHRONIC, EMPTY_CORE, medicalRecord } from './medical-record.fixture.js';
import { planNewRecord, planRecordChanges, requireRecordChanges } from './record-changes.js';

/** Body đã qua ValidationPipe (chuỗi đã cắt khoảng trắng, chuỗi rỗng đã thành null). */
const update = (body: object) => body as UpdateMedicalRecordDto;
const create = (body: object) => body as CreateMedicalRecordDto;

/** Mã và field của AppException mà `run` ném, hoặc null. */
function errorOf(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    const exception = error as { code?: string; data?: { field?: string } };
    return { code: exception.code, field: exception.data?.field };
  }
}

const capRecord = medicalRecord({ type: 'CAP', chronic: null });

describe('requireRecordChanges (spec B, mục 5.6: body PATCH cần ít nhất 1 trường)', () => {
  it.each([
    {},
    { self_report: {} },
    { acute: {}, chronic: {} },
    { self_report: { onset_weeks: undefined } },
  ])('%j → 2001', (body) => {
    expect(errorOf(() => requireRecordChanges(update(body)))).toEqual({
      code: '2001',
      field: undefined,
    });
  });

  it.each([
    { family_history: null },
    { first_visit_at: null },
    { self_report: { onset_weeks: 1 } },
    { chronic: { cindu_cold: false } },
  ])('%j → có thay đổi', (body) => {
    expect(errorOf(() => requireRecordChanges(update(body)))).toBeNull();
  });
});

describe('planRecordChanges: khối lệch loại hồ sơ → 2003 (spec B, mục 5.3, 5.6)', () => {
  it.each<[string, ReturnType<typeof medicalRecord>, object, string]>([
    ['acute cho hồ sơ MAN', medicalRecord(), { acute: { hospitalized: true } }, 'acute'],
    ['chronic cho hồ sơ CAP', capRecord, { chronic: { main_diagnosis: 'CSU' } }, 'chronic'],
    [
      'biểu hiện bệnh cho hồ sơ CAP',
      capRecord,
      { self_report: { disease_manifestation: 'Chi san phu' } },
      'self_report.disease_manifestation',
    ],
  ])('%s', (_title, record, body, field) => {
    expect(errorOf(() => planRecordChanges(record, update(body)))).toEqual({ code: '2003', field });
  });
});

describe('planRecordChanges: cặp cờ ↔ ghi rõ, kiểm sau khi gộp (D-B14)', () => {
  const stored = medicalRecord({
    core: { ...EMPTY_CORE, family_history: 'Co', family_history_detail: 'Mẹ bị mày đay' },
    chronic: { ...EMPTY_CHRONIC, cindu_other: true, cindu_other_detail: 'Do nóng' },
  });

  it('tắt cờ thì tự ghi NULL vào ô ghi rõ đang lưu', () => {
    expect(planRecordChanges(stored, update({ family_history: 'Khong' })).core).toEqual({
      family_history: 'Khong',
      family_history_detail: null,
    });
    expect(planRecordChanges(stored, update({ chronic: { cindu_other: false } })).chronic).toEqual({
      cindu_other: false,
      cindu_other_detail: null,
    });
  });

  it('cờ không bật (sau khi gộp) mà gửi ghi rõ khác rỗng → 2003', () => {
    expect(
      errorOf(() => planRecordChanges(medicalRecord(), update({ family_history_detail: 'Bố' }))),
    ).toEqual({
      code: '2003',
      field: 'family_history_detail',
    });
    expect(
      errorOf(() =>
        planRecordChanges(
          stored,
          update({ family_history: 'Khong ro', family_history_detail: 'Bố' }),
        ),
      ),
    ).toEqual({ code: '2003', field: 'family_history_detail' });
    expect(
      errorOf(() =>
        planRecordChanges(
          medicalRecord(),
          update({ chronic: { cindu_other: false, cindu_other_detail: 'Do nóng' } }),
        ),
      ),
    ).toEqual({ code: '2003', field: 'chronic.cindu_other_detail' });
  });

  it('cờ bật (sau khi gộp) mà thiếu ghi rõ → 2001', () => {
    expect(
      errorOf(() => planRecordChanges(medicalRecord(), update({ family_history: 'Co' }))),
    ).toEqual({
      code: '2001',
      field: 'family_history_detail',
    });
    expect(
      errorOf(() => planRecordChanges(stored, update({ family_history_detail: null }))),
    ).toEqual({
      code: '2001',
      field: 'family_history_detail',
    });
    expect(
      errorOf(() => planRecordChanges(medicalRecord(), update({ chronic: { cindu_other: true } }))),
    ).toEqual({
      code: '2001',
      field: 'chronic.cindu_other_detail',
    });
  });

  it('cờ đang bật: sửa riêng ô ghi rõ được; gửi cả cờ và ghi rõ được', () => {
    expect(planRecordChanges(stored, update({ family_history_detail: 'Bố bị hen' })).core).toEqual({
      family_history_detail: 'Bố bị hen',
    });
    expect(
      planRecordChanges(
        medicalRecord(),
        update({ chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' } }),
      ).chronic,
    ).toEqual({ cindu_other: true, cindu_other_detail: 'Do nóng' });
  });

  it('cờ tắt và ô ghi rõ đang trống: gửi null cho ô ghi rõ được, không thêm gì', () => {
    expect(
      planRecordChanges(
        medicalRecord(),
        update({ family_history: 'Khong', family_history_detail: null }),
      ).core,
    ).toEqual({ family_history: 'Khong', family_history_detail: null });
  });
});

describe('planRecordChanges: ngày ngoại trú sau khi gộp (ck_hosobenhan_ngay_dieu_tri, SQL:280–282)', () => {
  const stored = medicalRecord({
    core: { ...EMPTY_CORE, outpatient_start_date: '2026-11-01', outpatient_end_date: '2026-11-10' },
  });

  it('ngày kết thúc sớm hơn ngày bắt đầu đang lưu → 2003', () => {
    expect(
      errorOf(() => planRecordChanges(stored, update({ outpatient_end_date: '2026-10-31' }))),
    ).toEqual({
      code: '2003',
      field: 'outpatient_end_date',
    });
  });

  it('dời ngày bắt đầu qua sau ngày kết thúc đang lưu → 2003', () => {
    expect(
      errorOf(() => planRecordChanges(stored, update({ outpatient_start_date: '2026-11-15' }))),
    ).toEqual({
      code: '2003',
      field: 'outpatient_end_date',
    });
  });

  it('bằng nhau, sau, hoặc xoá một bên → được', () => {
    for (const body of [
      { outpatient_end_date: '2026-11-01' },
      { outpatient_end_date: '2026-11-30' },
      { outpatient_start_date: null },
      { outpatient_start_date: '2026-11-15', outpatient_end_date: null },
    ]) {
      expect(errorOf(() => planRecordChanges(stored, update(body)))).toBeNull();
    }
  });
});

describe('planRecordChanges: kết quả', () => {
  it('chỉ khoá đã gửi; first_visit_at → Date, null = xoá, vắng = không có khoá', () => {
    expect(
      planRecordChanges(
        medicalRecord(),
        update({
          first_visit_at: '2026-11-15T15:30:00+07:00',
          treated_before_visit: false,
          self_report: { onset_weeks: 2, referral_diagnosis: undefined },
        }),
      ),
    ).toEqual({
      firstVisitAt: new Date('2026-11-15T08:30:00.000Z'),
      selfReport: { onset_weeks: 2 },
      core: { treated_before_visit: false },
      acute: {},
      chronic: {},
    });
    expect(
      planRecordChanges(medicalRecord(), update({ first_visit_at: null })).firstVisitAt,
    ).toBeNull();
    expect(
      planRecordChanges(medicalRecord(), update({ treated_before_visit: true })),
    ).not.toHaveProperty('firstVisitAt');
  });

  it('hồ sơ CAP: khối acute giữ nguyên trường đã gửi (kể cả null), chronic rỗng', () => {
    expect(
      planRecordChanges(
        capRecord,
        update({ acute: { hospitalized: null, exposure_to_onset_seconds: 600 } }),
      ),
    ).toMatchObject({ acute: { hospitalized: null, exposure_to_onset_seconds: 600 }, chronic: {} });
  });
});

describe('planNewRecord (POST: gộp với hồ sơ trống)', () => {
  it('khối theo loại hồ sơ; luật ghi rõ, ngày, khối lệch loại như PATCH', () => {
    expect(
      planNewRecord(
        create({
          record_type: 'MAN',
          family_history: 'Co',
          family_history_detail: 'Mẹ',
          self_report: { disease_manifestation: 'Chi phu mach' },
          chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
        }),
      ),
    ).toEqual({
      selfReport: { disease_manifestation: 'Chi phu mach' },
      core: { family_history: 'Co', family_history_detail: 'Mẹ' },
      acute: {},
      chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
    });
    expect(errorOf(() => planNewRecord(create({ record_type: 'CAP', chronic: {} })))).toEqual({
      code: '2003',
      field: 'chronic',
    });
    expect(
      errorOf(() => planNewRecord(create({ record_type: 'MAN', family_history: 'Co' }))),
    ).toEqual({
      code: '2001',
      field: 'family_history_detail',
    });
    expect(
      errorOf(() =>
        planNewRecord(
          create({
            record_type: 'MAN',
            outpatient_start_date: '2026-11-10',
            outpatient_end_date: '2026-11-01',
          }),
        ),
      ),
    ).toEqual({ code: '2003', field: 'outpatient_end_date' });
  });
});
