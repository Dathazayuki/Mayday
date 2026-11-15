import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
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

/** Mã và field mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function errorFor<T extends object>(
  type: ClassConstructor<T>,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(type, body));
  if (errors.length === 0) return null;
  const exception = validationErrorsToException(errors);
  return { code: exception.code, field: (exception.data as { field?: string } | undefined)?.field };
}

/** Body sau ValidationPipe toàn cục (transform + whitelist). */
async function throughPipe(type: ClassConstructor<object>, body: Record<string, unknown>) {
  return (await createValidationPipe().transform(body, { type: 'body', metatype: type })) as Record<
    string,
    unknown
  >;
}

/** Thuộc tính mà DTO khai báo luật class-validator (kể cả lớp cha). */
function propertiesOf(target: ClassConstructor<object>): string[] {
  const metadatas = getMetadataStorage().getTargetValidationMetadatas(target, '', true, false);
  return [...new Set(metadatas.map((metadata) => metadata.propertyName))].sort();
}

const BLOCKS: [string, readonly ClinicalField[], ClassConstructor<object>][] = [
  ['self_report', SELF_REPORT_FIELDS, SelfReportDto],
  ['lõi hồ sơ', RECORD_CORE_FIELDS, RecordCoreDto],
  ['acute', RECORD_ACUTE_FIELDS, AcuteRecordDto],
  ['chronic', RECORD_CHRONIC_FIELDS, ChronicRecordDto],
];

/** Một giá trị hợp lệ theo bộ mô tả. */
function validValue(field: ClinicalField): unknown {
  switch (field.type) {
    case 'bool':
      return true;
    case 'enum':
      return field.options[0]!.value;
    case 'text':
      return '  Ghi chú  ';
    case 'suggest':
      return field.suggestions[0] ?? 'Ghi chú';
    case 'int':
      return field.min;
    case 'decimal':
      return field.places === 1 ? 37.5 : 1.25;
    case 'date':
      return '2026-11-15';
    case 'datetime':
      return '2026-11-15T08:30:00.000Z';
    case 'duration':
      return 3600;
  }
}

/** Giá trị sai theo bộ mô tả: [mô tả, mã ValidationPipe phải trả, giá trị] (spec B, mục 5.6). */
function invalidCases(field: ClinicalField): [string, string, unknown][] {
  switch (field.type) {
    case 'bool':
      return [
        ['chuỗi "true"', '2002', 'true'],
        ['số 1', '2002', 1],
      ];
    case 'enum':
      return [['ngoài tập của CHECK', '2003', 'gia tri la']];
    case 'text':
    case 'suggest':
      return [
        ['số', '2002', 5],
        ['dài hơn giới hạn', '2003', 'a'.repeat(field.maxLength + 1)],
      ];
    case 'int':
    case 'duration':
      return [
        ['số lẻ', '2002', 1.5],
        ['chuỗi số', '2002', '5'],
        ['âm', '2003', -1],
        ['vượt giới hạn', '2003', field.max + 1],
      ];
    case 'decimal':
      return [
        ['chuỗi số', '2002', '1'],
        ['quá số chữ số thập phân', '2003', field.places === 1 ? 1.25 : 1.255],
        ['dưới giới hạn', '2003', field.min - 1],
        ['vượt giới hạn', '2003', field.max + 1],
      ];
    case 'date':
      return [
        ['dạng dd/MM/yyyy', '2006', '15/11/2026'],
        ['ngày không có thật', '2006', '2026-02-30'],
        ['số', '2002', 20261115],
      ];
    case 'datetime':
      return [
        ['thiếu múi giờ', '2006', '2026-11-15T08:30:00'],
        ['chỉ có ngày', '2006', '2026-11-15'],
      ];
  }
}

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
