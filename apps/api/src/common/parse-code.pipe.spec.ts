import { parseCodePipe } from './parse-code.pipe.js';

const metadata = { type: 'param', data: 'id' } as const;

describe('parseCodePipe', () => {
  it('mã khớp CODE_PATTERN, không quá độ dài tối đa → giữ nguyên', () => {
    expect(parseCodePipe(50).transform('Q_ITCH_LEVEL', metadata)).toBe('Q_ITCH_LEVEL');
    expect(parseCodePipe(5).transform('ABCDE', metadata)).toBe('ABCDE');
  });

  // Mã sai định dạng không thể là mã của bản ghi nào; chặn trước khi tra CSDL vì collation của MySQL
  // không phân biệt hoa/thường và dấu ("tmpl_a" sẽ khớp "TMPL_A").
  it.each(['tmpl_a', 'TMPL-A', 'TMPL A', 'TMPLÁ', ''])('%j → 2003 kèm tên tham số', (value) => {
    expect(() => parseCodePipe(255).transform(value, metadata)).toThrowError(
      expect.objectContaining({ code: '2003', data: { field: 'id' } }),
    );
  });

  it('dài quá độ dài tối đa → 2003; báo đúng tên tham số được truyền vào', () => {
    expect(() => parseCodePipe(5, 'template_id').transform('ABCDEF', metadata)).toThrowError(
      expect.objectContaining({ code: '2003', data: { field: 'template_id' } }),
    );
  });
});
