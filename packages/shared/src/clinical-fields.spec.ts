import {
  AAS7_MAX,
  CLINICAL_GROUP_LABELS,
  DURATION_MAX_SECONDS,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  selfReportFieldsFor,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  WEEKS_MAX,
  type ClinicalField,
} from './clinical-fields.js';
import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  MAIN_DIAGNOSES,
} from './contracts/medical-records.js';
import { FIELD_LIMITS } from './field-limits.js';

const BLOCKS: Record<string, readonly ClinicalField[]> = {
  SELF_REPORT_FIELDS,
  RECORD_CORE_FIELDS,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
};

const field = (fields: readonly ClinicalField[], key: string): ClinicalField => {
  const found = fields.find((item) => item.key === key);
  if (!found) throw new Error(`Không có trường ${key}`);
  return found;
};

const optionValues = (item: ClinicalField) =>
  item.type === 'enum' ? item.options.map((o) => o.value) : [];

describe('bộ mô tả trường lâm sàng (D-B13, spec B mục 5.7)', () => {
  it('đủ 7 khối, số trường theo bảng cột của spec B (mục 3.2–3.7)', () => {
    expect(
      Object.fromEntries(Object.entries(BLOCKS).map(([name, items]) => [name, items.length])),
    ).toEqual({
      SELF_REPORT_FIELDS: 4,
      RECORD_CORE_FIELDS: 7,
      RECORD_ACUTE_FIELDS: 25,
      RECORD_CHRONIC_FIELDS: 10,
      VISIT_CORE_FIELDS: 9,
      VISIT_ACUTE_FIELDS: 10,
      VISIT_CHRONIC_FIELDS: 33,
    });
  });

  it.each(Object.entries(BLOCKS))(
    '%s: khoá không trùng, nhãn khác rỗng, nhóm có nhãn',
    (_name, items) => {
      const keys = items.map((item) => item.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const item of items) {
        expect(item.label.trim()).not.toBe('');
        expect(CLINICAL_GROUP_LABELS[item.group]).toBeTruthy();
      }
    },
  );

  it('khối self_report đúng 4 biến "App BN (BS sửa)" ở mức hồ sơ (D-B31: docs/04 #20, #21, #28, #29)', () => {
    expect(SELF_REPORT_FIELDS.map((item) => [item.key, item.source])).toEqual([
      ['referral_diagnosis', 20],
      ['initial_clinic_diagnosis', 21],
      ['onset_weeks', 28],
      ['disease_manifestation', 29],
    ]);
  });

  it('mọi enum có nhãn cho đúng tập giá trị của CHECK, theo thứ tự', () => {
    expect(optionValues(field(SELF_REPORT_FIELDS, 'disease_manifestation'))).toEqual([
      ...DISEASE_MANIFESTATIONS,
    ]);
    expect(optionValues(field(RECORD_CORE_FIELDS, 'insurance_treatment_result'))).toEqual([
      ...INSURANCE_TREATMENT_RESULTS,
    ]);
    expect(optionValues(field(RECORD_CORE_FIELDS, 'family_history'))).toEqual([
      ...FAMILY_HISTORY_VALUES,
    ]);
    expect(optionValues(field(RECORD_CHRONIC_FIELDS, 'main_diagnosis'))).toEqual([
      ...MAIN_DIAGNOSES,
    ]);
    expect(optionValues(field(RECORD_CHRONIC_FIELDS, 'csu_subtype'))).toEqual([...CSU_SUBTYPES]);
    for (const item of Object.values(BLOCKS).flat()) {
      if (item.type === 'enum') {
        expect(item.options.every((option) => option.label.trim() !== '')).toBe(true);
      }
    }
  });

  it('ô ghi rõ có CHECK ghép cờ (D-B14) trỏ tới một cờ có thật trong cùng khối', () => {
    const pairs = Object.values(BLOCKS).flatMap((items) =>
      items.flatMap((item) =>
        item.type === 'text' && item.detailOf ? [[items, item] as const] : [],
      ),
    );
    expect(pairs.map(([, item]) => [item.key, item.detailOf])).toEqual([
      ['family_history_detail', { flag: 'family_history', when: 'Co' }],
      ['cindu_other_detail', { flag: 'cindu_other', when: true }],
      ['angioedema_other_site_detail', { flag: 'angioedema_other_site', when: true }],
    ]);
    for (const [items, item] of pairs) {
      const flag = field(items, item.detailOf!.flag);
      if (typeof item.detailOf!.when === 'boolean') expect(flag.type).toBe('bool');
      else expect(optionValues(flag)).toContain(item.detailOf!.when);
    }
  });

  it('giới hạn theo cột: TEXT ≤ clinical_text; NUMERIC(12,2); NUMERIC(4,1) > 0; AAS7 0–105; INTERVAL là duration', () => {
    for (const item of Object.values(BLOCKS).flat()) {
      if (item.type === 'text' || item.type === 'suggest') {
        expect(item.maxLength).toBe(FIELD_LIMITS.clinical_text);
      }
    }
    expect(field(SELF_REPORT_FIELDS, 'onset_weeks')).toMatchObject({
      type: 'decimal',
      min: 0,
      max: WEEKS_MAX,
      places: 2,
    });
    expect(field(VISIT_CORE_FIELDS, 'fever_temperature_c')).toMatchObject({
      type: 'decimal',
      min: TEMPERATURE_MIN,
      max: TEMPERATURE_MAX,
      places: 1,
    });
    expect(field(VISIT_CHRONIC_FIELDS, 'aas7_score')).toMatchObject({
      type: 'int',
      min: 0,
      max: AAS7_MAX,
    });
    expect(
      RECORD_ACUTE_FIELDS.filter((item) => item.type === 'duration').map((item) => [
        item.key,
        item.max,
      ]),
    ).toEqual([
      ['exposure_to_onset_seconds', DURATION_MAX_SECONDS],
      ['mean_duration_seconds', DURATION_MAX_SECONDS],
      ['last_episode_ago_seconds', DURATION_MAX_SECONDS],
    ]);
  });

  it('cột TEXT không CHECK mà docs/04 có danh mục: gợi ý nguyên văn docs/04, vẫn gõ tự do (MT-125 a)', () => {
    expect(field(VISIT_CHRONIC_FIELDS, 'wheal_location')).toMatchObject({
      type: 'suggest',
      suggestions: ['Khap co the', 'Vi tri dac biet', 'Khong ro'],
    });
    expect(field(VISIT_CHRONIC_FIELDS, 'angioedema_side')).toMatchObject({
      type: 'suggest',
      suggestions: ['Một bên', 'Hai bên'],
    });
  });

  it('bệnh án cấp không có biến ở docs/04: nhóm "Bệnh án cấp", nhãn suy từ tên cột (MT-125 e)', () => {
    expect(new Set(RECORD_ACUTE_FIELDS.map((item) => item.group))).toEqual(new Set(['acute']));
    expect(new Set(VISIT_ACUTE_FIELDS.map((item) => item.group))).toEqual(new Set(['acute']));
    expect(field(RECORD_ACUTE_FIELDS, 'secondary_disease').source).toBe(23);
  });

  it('selfReportFieldsFor: hồ sơ CAP không có biểu hiện bệnh (#29), hồ sơ MAN đủ 4 trường (D-B31)', () => {
    expect(selfReportFieldsFor('CAP').map((item) => item.key)).toEqual([
      'referral_diagnosis',
      'initial_clinic_diagnosis',
      'onset_weeks',
    ]);
    expect(selfReportFieldsFor('MAN')).toBe(SELF_REPORT_FIELDS);
  });
});
