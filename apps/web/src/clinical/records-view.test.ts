import { parseRecordsView, recordsFilter, recordsViewParams } from './records-view';

const parse = (search: string) => parseRecordsView(new URLSearchParams(search));

describe('records-view: trạng thái trang bệnh án trên URL (spec B, mục 8.1, 8.5)', () => {
  it('mặc định: chế độ cột (D-B25), không lọc', () => {
    expect(parse('')).toEqual({ mode: 'board', status: undefined, type: undefined, mine: false });
  });

  it('đọc view, status, type, mine=1', () => {
    expect(parse('view=table&status=pending&type=CAP&mine=1')).toEqual({
      mode: 'table',
      status: 'pending',
      type: 'CAP',
      mine: true,
    });
  });

  it('giá trị lạ về mặc định', () => {
    expect(parse('view=abc&status=open&type=XYZ&mine=yes')).toEqual({
      mode: 'board',
      status: undefined,
      type: undefined,
      mine: false,
    });
  });

  it('ghi lên URL: luôn có view; status chỉ ở chế độ bảng; bỏ bộ lọc rỗng; đọc lại ra như cũ', () => {
    expect(recordsViewParams({ mode: 'board', mine: false }).toString()).toBe('view=board');
    expect(
      recordsViewParams({ mode: 'board', status: 'pending', type: 'MAN', mine: true }).toString(),
    ).toBe('view=board&type=MAN&mine=1');
    const table = { mode: 'table', status: 'completed', type: 'CAP', mine: true } as const;
    expect(recordsViewParams(table).toString()).toBe('view=table&status=completed&type=CAP&mine=1');
    expect(parseRecordsView(recordsViewParams(table))).toEqual(table);
  });

  it('bộ lọc: loại; "Tôi phụ trách" → doctor_id là người đăng nhập', () => {
    expect(recordsFilter({ mode: 'board', type: 'CAP', mine: false }, 5)).toEqual({
      record_type: 'CAP',
      doctor_id: undefined,
    });
    expect(recordsFilter({ mode: 'table', mine: true }, 5)).toEqual({
      record_type: undefined,
      doctor_id: 5,
    });
  });
});
