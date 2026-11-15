import { errorFor, throughPipe } from './clinical-field.fixture.js';
import {
  AcceptMedicalRecordDto,
  CloseMedicalRecordDto,
  UpdateMedicalRecordStatusDto,
} from './transition.dto.js';

describe('AcceptMedicalRecordDto (medrec07, MT-115)', () => {
  it('body rỗng, room_id số hoặc null → hợp lệ; trường lạ bị whitelist bỏ', async () => {
    expect(await errorFor(AcceptMedicalRecordDto, {})).toBeNull();
    expect(await errorFor(AcceptMedicalRecordDto, { room_id: 2 })).toBeNull();
    expect(await errorFor(AcceptMedicalRecordDto, { room_id: null })).toBeNull();
    expect(await throughPipe(AcceptMedicalRecordDto, { room_id: 2, doctor_id: 9 })).toEqual({
      room_id: 2,
    });
  });

  it.each<[string, unknown, string]>([
    ['dạng chuỗi', '2', '2002'],
    ['số lẻ', 1.5, '2002'],
    ['vượt MAX_ID', Number.MAX_SAFE_INTEGER + 2, '2003'],
  ])('room_id %s → %s', async (_title, room_id, code) => {
    expect(await errorFor(AcceptMedicalRecordDto, { room_id })).toEqual({ code, field: 'room_id' });
  });
});

describe('CloseMedicalRecordDto (medrec11)', () => {
  it('completed, cancelled hợp lệ; instructions cắt khoảng trắng, chuỗi rỗng = xoá (null), vắng = giữ', async () => {
    expect(await errorFor(CloseMedicalRecordDto, { status: 'completed' })).toBeNull();
    expect(await errorFor(CloseMedicalRecordDto, { status: 'cancelled' })).toBeNull();
    expect(
      await throughPipe(CloseMedicalRecordDto, {
        status: 'completed',
        instructions: '  Tái khám sau 4 tuần  ',
      }),
    ).toEqual({ status: 'completed', instructions: 'Tái khám sau 4 tuần' });
    expect(
      await throughPipe(CloseMedicalRecordDto, { status: 'cancelled', instructions: '   ' }),
    ).toEqual({ status: 'cancelled', instructions: null });
    expect((await throughPipe(CloseMedicalRecordDto, { status: 'cancelled' })).instructions).toBe(
      undefined,
    );
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['thiếu status', {}, '2001', 'status'],
    ['status rỗng', { status: '' }, '2001', 'status'],
    ['status không phải chuỗi', { status: 1 }, '2002', 'status'],
    ['status ngoài {completed, cancelled}', { status: 'in_progress' }, '4009', 'status'],
    [
      'status sai và instructions quá dài: 4009 trước 2003 (thứ tự mục 5.3)',
      { status: 'pending', instructions: 'a'.repeat(2001) },
      '4009',
      'status',
    ],
    [
      'instructions quá 2000 ký tự (D-B29)',
      { status: 'completed', instructions: 'a'.repeat(2001) },
      '2003',
      'instructions',
    ],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(CloseMedicalRecordDto, body)).toEqual({ code, field });
  });
});

describe('UpdateMedicalRecordStatusDto (PATCH /:id/status)', () => {
  it('chỉ cancelled; khác → 4009 (spec B, mục 5.3); thiếu → 2001', async () => {
    expect(await errorFor(UpdateMedicalRecordStatusDto, { status: 'cancelled' })).toBeNull();
    expect(await errorFor(UpdateMedicalRecordStatusDto, { status: 'completed' })).toEqual({
      code: '4009',
      field: 'status',
    });
    expect(await errorFor(UpdateMedicalRecordStatusDto, {})).toEqual({
      code: '2001',
      field: 'status',
    });
  });
});
