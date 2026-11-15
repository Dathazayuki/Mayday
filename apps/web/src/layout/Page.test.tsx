import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { Page } from './Page';
import { ShellContext } from './shell-context';

function renderPage(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Page', () => {
  it('hiện tiêu đề, phụ đề, nút quay lại, thao tác và nội dung', () => {
    renderPage(
      <Page
        title="Bệnh án #5"
        subtitle="Mày đay mạn"
        back={{ to: '/medical-records', label: 'Bệnh án' }}
        actions={<button type="button">Chốt bệnh án</button>}
      >
        <p>Nội dung</p>
      </Page>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Bệnh án #5' })).toBeInTheDocument();
    expect(screen.getByText('Mày đay mạn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bệnh án/ })).toHaveAttribute(
      'href',
      '/medical-records',
    );
    expect(screen.getByRole('button', { name: 'Chốt bệnh án' })).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
  });

  it('ngoài shell thì không có công cụ chung và nút mở menu', () => {
    renderPage(<Page title="Người dùng" />);
    expect(screen.queryByRole('button', { name: 'Mở menu' })).not.toBeInTheDocument();
  });

  it('trong shell thì hiện công cụ chung và nút mở menu gọi openNav', async () => {
    const openNav = vi.fn();
    renderPage(
      <ShellContext.Provider value={{ tools: <span>công cụ</span>, openNav }}>
        <Page title="Người dùng" />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('công cụ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(openNav).toHaveBeenCalledOnce();
  });
});
