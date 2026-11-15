import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import {
  errorFor,
  invalidCases,
  propertiesOf,
  throughPipe,
  validValue,
} from './clinical-field.fixture.js';
import {
  AcuteRecordDto,
  ChronicRecordDto,
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  RecordCoreDto,
  SelfReportDto,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './medical-record.dto.js';

const BLOCKS: [string, readonly ClinicalField[], ClassConstructor<object>][] = [
  ['self_report', SELF_REPORT_FIELDS, SelfReportDto],
  ['lõi hồ sơ', RECORD_CORE_FIELDS, RecordCoreDto],
  ['acute', RECORD_ACUTE_FIELDS, AcuteRecordDto],
  ['chronic', RECORD_CHRONIC_FIELDS, ChronicRecordDto],
];

const FIELD_CASES = BLOCKS.flatMap(([, fields, dto]) =>
  fields.map((field) => [field.key, field, dto] as const),
);

describe('đối chiếu bộ mô tả với DTO (D-B13)', () => {
  it.each(BLOCKS)('%s: khoá của bộ mô tả trùng thuộc tính của DTO', (_name, fields, dto) => {
    expect(propertiesOf(dto)).toEqual(fields.map((field) => field.key).sort());
  });
});

describe('mọi trường lâm sàng theo kiểu của bộ mô tả (spec B, mục 5.6)', () => {
  it.each(FIELD_CASES)(
    '%s: nhận giá trị hợp lệ, null và chuỗi rỗng (xoá giá trị)',
    async (key, field, dto) => {
      expect(await errorFor(dto, { [key]: validValue(field) })).toBeNull();
      expect(await errorFor(dto, { [key]: null })).toBeNull();
      expect(await errorFor(dto, { [key]: '' })).toBeNull();
      expect((await throughPipe(dto, { [key]: '' }))[key]).toBeNull();
    },
  );

  it.each(
    FIELD_CASES.flatMap(([key, field, dto]) =>
      invalidCases(field).map(([what, code, value]) => [key, what, code, value, dto] as const),
    ),
  )('%s, %s → %s', async (key, _what, code, value, dto) => {
    expect(await errorFor(dto, { [key]: value })).toEqual({ code, field: key });
  });

  it('TEXT: cắt khoảng trắng hai đầu; chỉ có khoảng trắng = xoá (D-B29)', async () => {
    await expect(
      throughPipe(SelfReportDto, { referral_diagnosis: '  Mày đay  ' }),
    ).resolves.toMatchObject({
      referral_diagnosis: 'Mày đay',
    });
    await expect(throughPipe(SelfReportDto, { referral_diagnosis: '   ' })).resolves.toMatchObject({
      referral_diagnosis: null,
    });
  });
});

describe('CreateMedicalRecordDto (medrec03)', () => {
  it('khối lồng thành DTO; trường lạ (kể cả template_id, status) bị whitelist bỏ ở mọi cấp', async () => {
    const body = await throughPipe(CreateMedicalRecordDto, {
      patient_id: 7,
      record_type: 'MAN',
      first_visit_at: '2026-11-15T08:30:00+07:00',
      family_history: 'Co',
      family_history_detail: '  Mẹ bị mày đay  ',
      self_report: { onset_weeks: 10, la: 1 },
      chronic: { main_diagnosis: 'CSU', status: 'completed' },
      template_id: 'TMPL',
      status: 'completed',
    });
    expect(body).toMatchObject({
      patient_id: 7,
      record_type: 'MAN',
      first_visit_at: '2026-11-15T08:30:00+07:00',
      family_history: 'Co',
      family_history_detail: 'Mẹ bị mày đay',
      self_report: { onset_weeks: 10 },
      chronic: { main_diagnosis: 'CSU' },
    });
    expect(body).not.toHaveProperty('template_id');
    expect(body).not.toHaveProperty('status');
    expect(body.self_report).toBeInstanceOf(SelfReportDto);
    expect(body.self_report).not.toHaveProperty('la');
    expect(body.chronic).not.toHaveProperty('status');
  });

  it('vắng patient_id hợp lệ ở DTO (bệnh nhân không gửi; nhân viên thiếu → 2001 ở service)', async () => {
    expect(await errorFor(CreateMedicalRecordDto, { record_type: 'CAP' })).toBeNull();
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['thiếu record_type', {}, '2001', 'record_type'],
    ['record_type ngoài CAP/MAN', { record_type: 'CAPMAN' }, '2003', 'record_type'],
    ['patient_id null', { record_type: 'MAN', patient_id: null }, '2001', 'patient_id'],
    ['patient_id dạng chuỗi', { record_type: 'MAN', patient_id: '7' }, '2002', 'patient_id'],
    ['khối không phải object', { record_type: 'MAN', chronic: 'CSU' }, '2002', 'chronic'],
    ['khối là mảng', { record_type: 'CAP', acute: [{ hospitalized: true }] }, '2002', 'acute'],
    ['khối null', { record_type: 'MAN', self_report: null }, '2001', 'self_report'],
    [
      'lỗi trong khối báo đường dẫn đầy đủ',
      { record_type: 'CAP', acute: { hospitalized: 'có' } },
      '2002',
      'acute.hospitalized',
    ],
    [
      'first_visit_at thiếu múi giờ',
      { record_type: 'MAN', first_visit_at: '2026-11-15T08:30:00' },
      '2006',
      'first_visit_at',
    ],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(CreateMedicalRecordDto, body)).toEqual({ code, field });
  });
});

describe('UpdateMedicalRecordDto (PATCH /medical_records/:id)', () => {
  it('record_type, patient_id, status không có trong DTO: whitelist bỏ (D-B3, MT-127)', async () => {
    const body = await throughPipe(UpdateMedicalRecordDto, {
      record_type: 'CAP',
      patient_id: 9,
      status: 'completed',
      treated_before_visit: false,
    });
    expect(body).toEqual({ treated_before_visit: false });
  });

  it('first_visit_at null = xoá thời điểm khám lần đầu (nhân viên)', async () => {
    expect(await errorFor(UpdateMedicalRecordDto, { first_visit_at: null })).toBeNull();
  });
});

describe('ListMedicalRecordsQuery, StatusCountsQuery (medrec04, status-counts)', () => {
  it('phân trang mặc định; bộ lọc vắng hoặc rỗng = không lọc; id dạng chuỗi → number', async () => {
    expect(
      plainToInstance(ListMedicalRecordsQuery, {
        status: '',
        record_type: ' ',
        patient_id: '7',
        doctor_id: '5',
      }),
    ).toMatchObject({
      page: 1,
      limit: 20,
      status: undefined,
      record_type: undefined,
      patient_id: 7,
      doctor_id: 5,
    });
    expect(await errorFor(ListMedicalRecordsQuery, {})).toBeNull();
    expect(await errorFor(StatusCountsQuery, {})).toBeNull();
  });

  it.each<[string, ClassConstructor<object>, Record<string, unknown>, string, string]>([
    [
      'trạng thái ngoài 5 giá trị',
      ListMedicalRecordsQuery,
      { status: 'archived' },
      '2003',
      'status',
    ],
    ['loại ngoài CAP/MAN', ListMedicalRecordsQuery, { record_type: 'X' }, '2003', 'record_type'],
    ['patient_id sai dạng', ListMedicalRecordsQuery, { patient_id: 'abc' }, '2002', 'patient_id'],
    ['doctor_id số lẻ', StatusCountsQuery, { doctor_id: '1.5' }, '2002', 'doctor_id'],
    ['loại viết thường', StatusCountsQuery, { record_type: 'man' }, '2003', 'record_type'],
  ])('%s → %s', async (_title, type, query, code, field) => {
    expect(await errorFor(type, query)).toEqual({ code, field });
  });
});
