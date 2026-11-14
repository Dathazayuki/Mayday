import type { TemplateSectionDetail } from '@drmayday/shared';
import { nextOrder } from './mapping';
import { toSectionFormValues, toSectionRequest } from './section-payload';

const SECTION: TemplateSectionDetail = {
  section_id: '7',
  title: 'Triệu chứng',
  order: '2',
  is_required: '1',
  filled_by: 'doctor',
  questions: [],
};

describe('toSectionRequest', () => {
  it('order là chuỗi, cờ "0"/"1", bỏ filled_by khi chưa chọn', () => {
    expect(toSectionRequest({ title: ' Tiền sử ', order: 3, is_required: false })).toEqual({
      title: 'Tiền sử',
      order: '3',
      is_required: '0',
    });
  });

  it('gửi filled_by khi đã chọn', () => {
    expect(
      toSectionRequest({ title: 'A', order: 1, is_required: true, filled_by: 'patdoc' }),
    ).toEqual({ title: 'A', order: '1', is_required: '1', filled_by: 'patdoc' });
  });
});

describe('toSectionFormValues', () => {
  it('tạo mới: order kế tiếp, không bắt buộc', () => {
    expect(toSectionFormValues(null, 4)).toEqual({ title: '', order: 4, is_required: false });
  });

  it('sửa: đổi chuỗi/cờ của API về giá trị form', () => {
    expect(toSectionFormValues(SECTION, 9)).toEqual({
      title: 'Triệu chứng',
      order: 2,
      is_required: true,
      filled_by: 'doctor',
    });
  });
});

describe('nextOrder', () => {
  it('lấy order lớn nhất theo số (không theo chuỗi) cộng 1', () => {
    expect(nextOrder([{ order: '2' }, { order: '10' }, { order: '9' }])).toBe(11);
  });

  it('danh sách rỗng thì bắt đầu từ 1', () => {
    expect(nextOrder([])).toBe(1);
  });
});
