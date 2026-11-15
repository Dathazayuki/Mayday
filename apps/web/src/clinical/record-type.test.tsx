import { RECORD_TYPES } from '@drmayday/shared';
import { render, screen } from '@testing-library/react';
import { RECORD_TYPE_SHORT_LABELS, RecordTypeBadge } from './record-type';

describe('RecordTypeBadge (spec B, mục 8)', () => {
  it('chữ "Cấp"/"Mạn"', () => {
    expect(RECORD_TYPES.map((type) => RECORD_TYPE_SHORT_LABELS[type])).toEqual(['Cấp', 'Mạn']);
  });

  it.each(RECORD_TYPES)('%s: tông slate, không trùng tông trạng thái', (type) => {
    render(<RecordTypeBadge type={type} />);
    expect(screen.getByText(RECORD_TYPE_SHORT_LABELS[type])).toHaveClass(
      'dm-badge',
      'dm-badge--slate',
    );
  });
});
