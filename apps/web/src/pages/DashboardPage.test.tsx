import { App } from 'antd';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../test/helpers';
import { dashboardSummary } from '../test/dashboard-fixture';
import { DashboardPage } from './DashboardPage';

const STAFF_PROFILE = { user_id: 1, full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: 2 };
const PATIENT_PROFILE = { ...STAFF_PROFILE, role_id: 4, year_of_birth: 1990 };

/** Hiện đường dẫn đã mở (kể cả truy vấn). */
function LocationProbe() {
  const location = useLocation();
  return <div>Đang ở {location.pathname + location.search}</div>;
}

function setup(summary = dashboardSummary(), profile: object | Response = STAFF_PROFILE) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      if (url.endsWith('/profile')) {
        return Promise.resolve(profile instanceof Response ? profile : okResponse(profile));
      }
      if (url.endsWith('/dashboard/summary')) return Promise.resolve(okResponse(summary));
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/medical-records" element={<LocationProbe />} />
        <Route path="/medical-records/:id" element={<LocationProbe />} />
      </Routes>
    </App>,
  );
  return urls;
}

describe('DashboardPage: Tổng quan tối thiểu (spec B, mục 8.8; MT-123)', () => {
  it('tiêu đề "Tổng quan", phụ đề "Hôm nay dd/MM/yyyy" theo ngày của API', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(await screen.findByText('Hôm nay 16/11/2026')).toBeInTheDocument();
  });

  it('ô Chờ tiếp nhận, Đang khám, Hoàn tất (số .num) + dòng phụ Nháp, Đã huỷ; bấm ô → bảng lọc trạng thái', async () => {
    setup();
    const user = userEvent.setup();
    const pending = await screen.findByRole('link', { name: /^Chờ tiếp nhận/ });
    expect(pending).toHaveAttribute('href', '/medical-records?view=table&status=pending');
    expect(within(pending).getByText('2')).toHaveClass('num');
    expect(screen.getByRole('link', { name: /^Đang khám/ })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /^Hoàn tất/ })).toHaveAttribute(
      'href',
      '/medical-records?view=table&status=completed',
    );
    expect(screen.getByText(/^Nháp/).closest('.dm-stats__more')).toHaveTextContent(
      'Nháp 1 · Đã huỷ 5',
    );

    await user.click(pending);
    expect(
      await screen.findByText('Đang ở /medical-records?view=table&status=pending'),
    ).toBeInTheDocument();
  });

  it('"Phiên khám hôm nay": tổng + dòng (mã hồ sơ, bệnh nhân, lần khám, bác sĩ, phòng, trạng thái hồ sơ)', async () => {
    setup();
    const unassigned = (await screen.findByText('#14')).closest('tr')!;
    expect(within(unassigned).getByText('TRẦN VĂN BÌNH')).toBeInTheDocument();
    expect(within(unassigned).getByText('Lần 1')).toBeInTheDocument();
    expect(within(unassigned).getByText('BÁC SĨ MẪU HAI')).toBeInTheDocument();
    expect(within(unassigned).getByText('Chưa phân phòng')).toBeInTheDocument();
    expect(within(unassigned).getByText('Đang khám')).toBeInTheDocument();
    const panel = screen.getByText('Phiên khám hôm nay').closest('.dm-panel') as HTMLElement;
    expect(within(panel).getByText('Tổng').parentElement).toHaveTextContent('Tổng 2');
    expect(within(panel).getByText('Phòng khám 1')).toBeInTheDocument();
  });

  it('"Bệnh án tôi phụ trách": thẻ rút gọn mở màn chi tiết, link "Xem trên bảng cột" → cột, lọc tôi phụ trách', async () => {
    setup();
    const card = await screen.findByRole('link', { name: 'Bệnh án #12' });
    expect(card).toHaveAttribute('href', '/medical-records/12');
    expect(within(card).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem trên bảng cột' })).toHaveAttribute(
      'href',
      '/medical-records?view=board&mine=1',
    );
  });

  it('my_queue null (không phải bác sĩ) → không có panel "Bệnh án tôi phụ trách"', async () => {
    setup(dashboardSummary({ my_queue: null }));
    expect(await screen.findByText('Phiên khám hôm nay')).toBeInTheDocument();
    expect(screen.queryByText('Bệnh án tôi phụ trách')).not.toBeInTheDocument();
  });

  it('bệnh nhân đăng nhập web → lời nhắn dùng ứng dụng di động, không gọi API Tổng quan', async () => {
    const urls = setup(dashboardSummary(), PATIENT_PROFILE);
    expect(
      await screen.findByText(
        'Trang web dành cho nhân viên y tế. Bệnh nhân vui lòng dùng ứng dụng di động',
      ),
    ).toBeInTheDocument();
    expect(urls.some((url) => url.includes('/dashboard/summary'))).toBe(false);
  });

  it('lỗi tải hồ sơ người dùng → hiện lỗi, không treo ở khung chờ', async () => {
    const urls = setup(dashboardSummary(), errorResponse(500, '9999'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(document.querySelector('.ant-skeleton')).not.toBeInTheDocument();
    expect(urls.some((url) => url.includes('/dashboard/summary'))).toBe(false);
  });

  it('chưa có phiên khám hôm nay → "Chưa có phiên khám hôm nay"', async () => {
    setup(dashboardSummary({ visits_today: { total: 0, items: [] } }));
    expect(await screen.findByText('Chưa có phiên khám hôm nay')).toBeInTheDocument();
  });
});
