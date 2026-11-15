import {
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import type { ClassConstructor } from 'class-transformer';
import {
  errorFor,
  invalidCases,
  propertiesOf,
  throughPipe,
  validValue,
} from './clinical-field.fixture.js';
import {
  AcuteVisitDto,
  ChronicVisitDto,
  CreateVisitDto,
  UpdateVisitDto,
  VisitCoreDto,
} from './visit.dto.js';

const BLOCKS: [string, readonly ClinicalField[], ClassConstructor<object>][] = [
  ['lõi phiên', VISIT_CORE_FIELDS, VisitCoreDto],
  ['acute của phiên', VISIT_ACUTE_FIELDS, AcuteVisitDto],
  ['chronic của phiên', VISIT_CHRONIC_FIELDS, ChronicVisitDto],
];

/** ngay_kham là cột NOT NULL (SQL:404): không xoá được, kiểm riêng. */
const NOT_NULL = new Set(['visit_date']);

const FIELD_CASES = BLOCKS.flatMap(([, fields, dto]) =>
  fields.map((field) => [field.key, field, dto] as const),
);

describe('đối chiếu bộ mô tả với DTO phiên khám (D-B13)', () => {
  it.each(BLOCKS)('%s: khoá của bộ mô tả trùng thuộc tính của DTO', (_name, fields, dto) => {
    expect(propertiesOf(dto)).toEqual(fields.map((field) => field.key).sort());
  });
});

describe('mọi trường của phiên theo kiểu của bộ mô tả (spec B, mục 5.6)', () => {
  it.each(FIELD_CASES.filter(([key]) => !NOT_NULL.has(key)))(
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

  it('visit_date (NOT NULL): ngày hợp lệ → qua; null, chuỗi rỗng → 2001 (không xoá được)', async () => {
    expect(await errorFor(VisitCoreDto, { visit_date: '2026-11-15' })).toBeNull();
    expect(await errorFor(VisitCoreDto, { visit_date: null })).toEqual({
      code: '2001',
      field: 'visit_date',
    });
    expect(await errorFor(VisitCoreDto, { visit_date: '' })).toEqual({
      code: '2001',
      field: 'visit_date',
    });
  });
});

describe('UpdateVisitDto (PATCH /visits/:id)', () => {
  it('khối lồng thành DTO; doctor_id, visit_number, medical_record_id và trường lạ trong khối bị whitelist bỏ; TEXT cắt khoảng trắng', async () => {
    const body = await throughPipe(UpdateVisitDto, {
      visit_date: '2026-11-16',
      room_id: null,
      doctor_id: 9,
      visit_number: 4,
      medical_record_id: 13,
      instructions: '  Uống thuốc đều  ',
      chronic: { aas7_score: 12, la: 1 },
      acute: { has_wheals: true },
    });
    expect(body).toEqual({
      visit_date: '2026-11-16',
      room_id: null,
      instructions: 'Uống thuốc đều',
      chronic: { aas7_score: 12 },
      acute: { has_wheals: true },
    });
    expect(body.chronic).toBeInstanceOf(ChronicVisitDto);
    expect(body.acute).toBeInstanceOf(AcuteVisitDto);
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['room_id dạng chuỗi', { room_id: '2' }, '2002', 'room_id'],
    ['room_id số lẻ', { room_id: 1.5 }, '2002', 'room_id'],
    ['khối không phải object', { chronic: 'CSU' }, '2002', 'chronic'],
    ['khối null', { acute: null }, '2001', 'acute'],
    [
      'lỗi trong khối báo đường dẫn đầy đủ',
      { chronic: { aas7_score: 106 } },
      '2003',
      'chronic.aas7_score',
    ],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(UpdateVisitDto, body)).toEqual({ code, field });
  });
});

describe('CreateVisitDto (POST /medical_records/:id/visits)', () => {
  it('body rỗng hợp lệ (ngày = hôm nay, chưa phân phòng); chỉ giữ visit_date, room_id', async () => {
    expect(await errorFor(CreateVisitDto, {})).toBeNull();
    expect(
      await throughPipe(CreateVisitDto, {
        visit_date: '2026-11-16',
        room_id: 1,
        instructions: 'x',
        visit_number: 9,
      }),
    ).toEqual({ visit_date: '2026-11-16', room_id: 1 });
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['visit_date sai dạng', { visit_date: '16/11/2026' }, '2006', 'visit_date'],
    ['visit_date null', { visit_date: null }, '2001', 'visit_date'],
    ['room_id dạng chuỗi', { room_id: '1' }, '2002', 'room_id'],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(CreateVisitDto, body)).toEqual({ code, field });
  });
});
