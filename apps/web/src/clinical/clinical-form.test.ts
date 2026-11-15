import {
  ApiError,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import dayjs from 'dayjs';
import {
  clinicalChanges,
  clinicalSections,
  fieldErrorPath,
  fieldName,
  fromFormValue,
  initialFormValues,
  shownInView,
  toFormValue,
  type ClinicalBlock,
} from './clinical-form';

const field = (fields: readonly ClinicalField[], key: string): ClinicalField => {
  const found = fields.find((item) => item.key === key);
  if (!found) throw new Error(`không có trường ${key}`);
  return found;
};

const CORE: ClinicalBlock = {
  path: null,
  fields: RECORD_CORE_FIELDS,
  values: {
    first_visit_at: '2026-11-15T01:00:00.000Z',
    outpatient_start_date: '2026-11-01',
    outpatient_end_date: null,
    insurance_treatment_result: null,
    family_history: 'Co',
    family_history_detail: 'Mẹ bị mày đay mạn',
    treated_before_visit: null,
  },
};

const CHRONIC: ClinicalBlock = {
  path: 'chronic',
  fields: RECORD_CHRONIC_FIELDS,
  values: {
    main_diagnosis: 'CSU',
    csu_subtype: null,
    cindu_dermographism: true,
    cindu_cholinergic: false,
    cindu_cold: null,
    cindu_adrenergic: null,
    cindu_aquagenic: null,
    cindu_solar: null,
    cindu_other: false,
    cindu_other_detail: null,
  },
};

const ACUTE: ClinicalBlock = {
  path: 'acute',
  fields: RECORD_ACUTE_FIELDS,
  values: { exposure_to_onset_seconds: 1800, first_onset_age: 25, comorbidity_skin: null },
};

describe('clinical-form: giá trị API ↔ ô nhập (spec B, mục 8.7)', () => {
  it('bool: true/false/null ↔ Có/Không/Chưa rõ', () => {
    const flag = field(RECORD_CHRONIC_FIELDS, 'cindu_other');
    expect([true, false, null].map((value) => toFormValue(flag, value))).toEqual([
      'yes',
      'no',
      'unknown',
    ]);
    expect(['yes', 'no', 'unknown'].map((value) => fromFormValue(flag, value))).toEqual([
      true,
      false,
      null,
    ]);
  });

  it('enum: bỏ chọn (undefined) = null; text, suggest: cắt khoảng trắng, chuỗi rỗng = null (D-B29)', () => {
    expect(fromFormValue(field(RECORD_CHRONIC_FIELDS, 'main_diagnosis'), undefined)).toBeNull();
    expect(toFormValue(field(RECORD_CHRONIC_FIELDS, 'main_diagnosis'), null)).toBeUndefined();
    const text = field(SELF_REPORT_FIELDS, 'referral_diagnosis');
    expect(toFormValue(text, null)).toBe('');
    expect(fromFormValue(text, '  Mày đay  ')).toBe('Mày đay');
    expect(fromFormValue(text, '   ')).toBeNull();
    expect(fromFormValue(field(VISIT_CHRONIC_FIELDS, 'angioedema_side'), 'Một bên')).toBe(
      'Một bên',
    );
  });

  it('date ↔ YYYY-MM-DD, datetime ↔ ISO 8601 (D-B23), giữ nguyên ngày khi đi hai chiều', () => {
    const date = field(RECORD_CORE_FIELDS, 'outpatient_start_date');
    const datetime = field(RECORD_CORE_FIELDS, 'first_visit_at');
    expect(fromFormValue(date, toFormValue(date, '2026-11-01'))).toBe('2026-11-01');
    expect(fromFormValue(datetime, toFormValue(datetime, '2026-11-15T01:00:00.000Z'))).toBe(
      '2026-11-15T01:00:00.000Z',
    );
    expect(fromFormValue(date, null)).toBeNull();
    expect(toFormValue(datetime, null)).toBeNull();
  });

  it('duration: giây ↔ số + đơn vị (MT-124); chưa có số = null', () => {
    const duration = field(RECORD_ACUTE_FIELDS, 'exposure_to_onset_seconds');
    expect(toFormValue(duration, 1800)).toEqual({ amount: 30, unit: 'minute' });
    expect(toFormValue(duration, 7200)).toEqual({ amount: 2, unit: 'hour' });
    expect(toFormValue(duration, null)).toEqual({ amount: null, unit: 'minute' });
    expect(fromFormValue(duration, { amount: 1.5, unit: 'hour' })).toBe(5400);
    expect(fromFormValue(duration, { amount: null, unit: 'day' })).toBeNull();
  });

  it('initialFormValues lồng theo khoá của khối như body; fieldName trả đúng đường dẫn', () => {
    const values = initialFormValues([CORE, CHRONIC]);
    expect(values.family_history).toBe('Co');
    expect(values.chronic).toMatchObject({ main_diagnosis: 'CSU', cindu_other: 'no' });
    expect(fieldName(CHRONIC, 'main_diagnosis')).toEqual(['chronic', 'main_diagnosis']);
    expect(fieldName(CORE, 'family_history')).toEqual(['family_history']);
  });
});

describe('clinical-form: body PATCH chỉ có trường đã đổi (spec B, mục 8.7)', () => {
  it('không đổi gì → {}', () => {
    expect(clinicalChanges([CORE, CHRONIC], initialFormValues([CORE, CHRONIC]))).toEqual({});
  });

  it('chỉ trường đổi, lồng đúng khối; khối không đổi không có trong body', () => {
    const values = initialFormValues([CORE, CHRONIC]);
    const chronic = values.chronic as Record<string, unknown>;
    values.chronic = { ...chronic, main_diagnosis: 'CIndU', cindu_cold: 'yes' };
    values.outpatient_end_date = dayjs('2026-11-20');
    expect(clinicalChanges([CORE, CHRONIC], values)).toEqual({
      outpatient_end_date: '2026-11-20',
      chronic: { main_diagnosis: 'CIndU', cindu_cold: true },
    });
  });

  it('xoá giá trị: ô văn bản để trống, enum bỏ chọn, bool Chưa rõ → null', () => {
    const values = initialFormValues([CORE, CHRONIC]);
    values.family_history_detail = '  ';
    values.chronic = {
      ...(values.chronic as Record<string, unknown>),
      main_diagnosis: undefined,
      cindu_dermographism: 'unknown',
    };
    expect(clinicalChanges([CORE, CHRONIC], values)).toEqual({
      family_history_detail: null,
      chronic: { main_diagnosis: null, cindu_dermographism: null },
    });
  });

  it('ô ghi rõ đang ẩn (cờ tắt) không gửi: API tự ghi null (D-B14)', () => {
    const values = initialFormValues([CORE]);
    values.family_history = 'Khong';
    expect(clinicalChanges([CORE], values)).toEqual({ family_history: 'Khong' });
  });

  it('thời lượng gửi số giây; cùng thời điểm viết khác cách không coi là đổi', () => {
    const values = initialFormValues([CORE, ACUTE]);
    values.first_visit_at = dayjs('2026-11-15T08:00:00+07:00');
    values.acute = {
      ...(values.acute as Record<string, unknown>),
      exposure_to_onset_seconds: { amount: 2, unit: 'hour' },
    };
    expect(clinicalChanges([CORE, ACUTE], values)).toEqual({
      acute: { exposure_to_onset_seconds: 7200 },
    });
  });
});

describe('clinical-form: nhóm, ô ghi rõ, lỗi có field', () => {
  it('clinicalSections: nhóm theo phân nhóm docs/04, theo thứ tự xuất hiện, qua nhiều khối', () => {
    const visit: ClinicalBlock = { path: null, fields: VISIT_CORE_FIELDS, values: {} };
    const chronic: ClinicalBlock = { path: 'chronic', fields: VISIT_CHRONIC_FIELDS, values: {} };
    expect(clinicalSections([visit, chronic]).map((section) => section.key)).toEqual([
      'core-B1',
      'core-4',
      'core-8',
      'core-9',
      'chronic-2.2',
      'chronic-2.3',
      'chronic-A2',
    ]);
  });

  it('shownInView: ô ghi rõ chỉ hiện khi cờ đang lưu bật', () => {
    const detail = field(RECORD_CHRONIC_FIELDS, 'cindu_other_detail');
    expect(shownInView(detail, CHRONIC)).toBe(false);
    expect(shownInView(detail, { ...CHRONIC, values: { cindu_other: true } })).toBe(true);
    expect(shownInView(field(RECORD_CORE_FIELDS, 'family_history_detail'), CORE)).toBe(true);
  });

  it('fieldErrorPath: chỉ 2001/2003 có field; tách theo dấu chấm', () => {
    expect(
      fieldErrorPath(new ApiError('2001', 'x', 400, { field: 'chronic.cindu_other_detail' })),
    ).toEqual(['chronic', 'cindu_other_detail']);
    expect(
      fieldErrorPath(new ApiError('2003', 'x', 400, { field: 'outpatient_end_date' })),
    ).toEqual(['outpatient_end_date']);
    expect(fieldErrorPath(new ApiError('2003', 'x', 400))).toBeNull();
    expect(fieldErrorPath(new ApiError('3105', 'x', 403, { field: 'acute' }))).toBeNull();
    expect(fieldErrorPath(new Error('x'))).toBeNull();
  });
});
