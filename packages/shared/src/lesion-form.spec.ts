import { describe, expect, it } from 'vitest';
import type { LesionPhotoListItem } from './contracts/lesions.js';
import {
  buildContextInput,
  buildContextPatch,
  buildPhotoCreate,
  buildPhotoPatch,
  buildPhotoScores,
  emptyContextValues,
  newPhotoValues,
  textOrNull,
  toContextValues,
  toPhotoValues,
  validateContext,
  validatePhotoForm,
  type PhotoFormValues,
} from './lesion-form.js';

const photoValues = (overrides: Partial<PhotoFormValues> = {}): PhotoFormValues => ({
  ...newPhotoValues(),
  milestone: 'peak',
  taken_at: '2026-11-15 08:30:00',
  ...overrides,
});

describe('textOrNull', () => {
  it('cắt khoảng trắng; rỗng thành null', () => {
    expect(textOrNull('  abc ')).toBe('abc');
    expect(textOrNull('   ')).toBeNull();
    expect(textOrNull('')).toBeNull();
  });
});

describe('validateContext', () => {
  it('cho phép để trống', () => {
    expect(validateContext(emptyContextValues())).toEqual({});
  });

  it('báo ngày giờ sai định dạng hoặc ngày không có thật', () => {
    const check = (occurred_at: string) =>
      validateContext({ ...emptyContextValues(), occurred_at }).occurred_at;
    expect(check('15/11/2026')).toBeDefined();
    expect(check('2026-02-30 10:00:00')).toBeDefined();
    expect(check('2026-11-15 10:00:00')).toBeUndefined();
  });

  it('báo số "dùng cách đây" không phải số nguyên không âm', () => {
    const check = (medication_taken_ago: string) =>
      validateContext({ ...emptyContextValues(), medication_taken_ago }).medication_taken_ago;
    for (const bad of ['-1', '1.5', 'abc', '99999999999']) expect(check(bad)).toBeDefined();
    expect(check('0')).toBeUndefined();
  });
});

describe('buildContextPatch / buildContextInput', () => {
  const filled = {
    occurred_at: ' 2026-11-15 10:00:00 ',
    tags: ['Sau ăn', 'Sau ăn', ' Sau vận động '],
    context_other: ' khác ',
    medication_name: ' Cetirizin ',
    medication_taken_ago: ' 2 ',
    medication_unit: 'hour' as const,
  };

  it('PATCH gửi giá trị đã cắt, thẻ gom thành JSON không trùng', () => {
    expect(buildContextPatch(filled)).toEqual({
      occurred_at: '2026-11-15 10:00:00',
      context_tags: '["Sau ăn","Sau vận động"]',
      context_other: 'khác',
      medication_name: 'Cetirizin',
      medication_taken_ago: '2',
      medication_unit: 'hour',
    });
  });

  it('PATCH gửi null cho trường trống để xoá giá trị', () => {
    expect(buildContextPatch(emptyContextValues())).toEqual({
      occurred_at: null,
      context_tags: null,
      context_other: null,
      medication_name: null,
      medication_taken_ago: null,
      medication_unit: null,
    });
  });

  it('POST bỏ trường trống', () => {
    expect(buildContextInput(emptyContextValues())).toEqual({});
    const input = buildContextInput({
      ...emptyContextValues(),
      tags: ['Sau ăn'],
      medication_unit: 'day',
    });
    expect(input).toEqual({ context_tags: '["Sau ăn"]', medication_unit: 'day' });
  });

  it('POST giữ đủ các trường đã nhập', () => {
    expect(buildContextInput(filled)).toEqual({
      occurred_at: '2026-11-15 10:00:00',
      context_tags: '["Sau ăn","Sau vận động"]',
      context_other: 'khác',
      medication_name: 'Cetirizin',
      medication_taken_ago: '2',
      medication_unit: 'hour',
    });
  });
});

describe('toContextValues', () => {
  const data = {
    occurred_at: '2026-11-15 10:00:00',
    context_tags: '["Sau ăn"]',
    context_other: null,
    medication_name: null,
    medication_taken_ago: '3',
    medication_unit: 'day' as const,
  };

  it('đọc lại dữ liệu API, null thành chuỗi rỗng', () => {
    const values = toContextValues(data);
    expect(values.tags).toEqual(['Sau ăn']);
    expect(values.context_other).toBe('');
    expect(values.medication_taken_ago).toBe('3');
  });

  it('bỏ qua thẻ hỏng hoặc thiếu', () => {
    expect(toContextValues({ ...data, context_tags: 'không phải JSON' }).tags).toEqual([]);
    expect(toContextValues({ ...data, context_tags: null }).tags).toEqual([]);
  });
});

describe('validatePhotoForm', () => {
  it('bắt buộc chọn mốc', () => {
    expect(validatePhotoForm(photoValues({ milestone: null })).milestone).toBeDefined();
    expect(validatePhotoForm(photoValues())).toEqual({});
  });

  it('kiểm tra số nốt sẩn, AUAS cục bộ và thời điểm chụp', () => {
    const errors = validatePhotoForm(
      photoValues({ hives_count: '-2', local_auas: 'x', taken_at: 'hôm qua' }),
    );
    expect(Object.keys(errors).sort()).toEqual(['hives_count', 'local_auas', 'taken_at']);
  });

  it('cho phép để trống thời điểm chụp (chế độ sửa)', () => {
    expect(validatePhotoForm(photoValues({ taken_at: '' }))).toEqual({});
  });
});

describe('buildPhotoScores / buildPhotoCreate / buildPhotoPatch', () => {
  const ids = { episodeId: '1', locationId: '2', attachmentId: '3' };

  it('chỉ có điểm đã chấm và chỉ số đã nhập', () => {
    expect(
      buildPhotoScores(photoValues({ itch_score: '0', pain_score: '7', hives_count: ' 3 ' })),
    ).toEqual({ itch_score: '0', pain_score: '7', hives_count: '3' });
    expect(buildPhotoScores(photoValues())).toEqual({});
  });

  it('buildPhotoCreate ghép id, mốc, điểm và taken_at', () => {
    expect(buildPhotoCreate(photoValues({ itch_score: '4' }), ids)).toEqual({
      episode_id: '1',
      location_id: '2',
      attachment_id: '3',
      milestone: 'peak',
      itch_score: '4',
      taken_at: '2026-11-15 08:30:00',
    });
  });

  it('buildPhotoCreate bỏ taken_at trống và trả null khi chưa chọn mốc', () => {
    expect(buildPhotoCreate(photoValues({ taken_at: ' ' }), ids)).not.toHaveProperty('taken_at');
    expect(buildPhotoCreate(photoValues({ milestone: null }), ids)).toBeNull();
  });

  it('PATCH gửi null cho điểm và chỉ số để trống', () => {
    expect(buildPhotoPatch(photoValues({ burn_score: '2', local_auas: '5' }))).toEqual({
      milestone: 'peak',
      itch_score: null,
      pain_score: null,
      burn_score: '2',
      hives_count: null,
      local_auas: '5',
    });
  });

  it('toPhotoValues chuyển null thành chuỗi rỗng', () => {
    const photo = {
      photo_id: '1',
      episode_id: '1',
      location_id: '2',
      attachment_id: '3',
      taken_at: null,
      milestone: 'start',
      itch_score: '5',
      pain_score: null,
      burn_score: null,
      hives_count: null,
      local_auas: null,
      annotated_url: null,
      created_at: '',
      updated_at: '',
      attachment: { attachment_id: '3', file_url: '/x' },
    } satisfies LesionPhotoListItem;
    expect(toPhotoValues(photo)).toEqual({
      milestone: 'start',
      itch_score: '5',
      pain_score: '',
      burn_score: '',
      hives_count: '',
      local_auas: '',
      taken_at: '',
    });
  });
});
