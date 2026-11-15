import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('hiện chữ và gắn class theo tông', () => {
    render(<StatusBadge tone="amber">Chờ tiếp nhận</StatusBadge>);
    const badge = screen.getByText('Chờ tiếp nhận');
    expect(badge).toHaveClass('dm-badge', 'dm-badge--amber');
  });

  it('mặc định là tông trung tính', () => {
    render(<StatusBadge>Nháp</StatusBadge>);
    expect(screen.getByText('Nháp')).toHaveClass('dm-badge--neutral');
  });
});
