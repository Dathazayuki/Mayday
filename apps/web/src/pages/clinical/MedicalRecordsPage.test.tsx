import type { MedicalRecordStatus } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { medicalRecordListItem } from '../../test/medical-record-fixture';
import { MedicalRecordsPage } from './MedicalRecordsPage';

const BASE = 'http://localhost:3000/api/v1';

const COUNTS = { draft: 0, pending: 1, in_progress: 1, completed: 0, cancelled: 1 };

/** Mỗi trạng thái có thẻ: chờ tiếp nhận 101, đang khám 12, đã huỷ 5. */
const BY_STATUS: Partial<Record<MedicalRecordStatus, number>> = {
  pending: 101,
  in_progress: 12,
  cancelled: 5,
};

type Call = { method: string; url: string };

/** Hiện chuỗi truy vấn hiện tại để kiểm tham số trên URL. */
function LocationProbe() {
  return <output aria-label="URL">{useLocation().search}</output>;
}

/** `listTotal`: tổng số dòng API báo cho danh sách (mặc định bằng số dòng trả về, một trang). */
function setup(path = '/medical-records', listTotal?: number) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', url });
      const { pathname, searchParams } = new URL(url);
      if (pathname.endsWith('/medical_records/status-counts')) {
        return Promise.resolve(okResponse(COUNTS));
      }
      if (pathname.endsWith('/medical_records/all')) {
        const status = searchParams.get('status') as MedicalRecordStatus | null;
        const id = status ? BY_STATUS[status] : undefined;
        const data = status
          ? id
            ? [medicalRecordListItem({ medical_record_id: id, status })]
            : []
          : Object.entries(BY_STATUS).map(([s, recordId]) =>
              medicalRecordListItem({
                medical_record_id: recordId,
                status: s as MedicalRecordStatus,
              }),
            );
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data, total: listTotal ?? data.length }),
        );
      }
      if (pathname.endsWith('/doctor/patients/search')) {
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route
            path="/medical-records"
            element={
              <>
                <MedicalRecordsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </App>
    </ConfigProvider>,
    path,
  );
  return calls;
}

const url = () => screen.getByLabelText('URL').textContent;
const urlsOf = (calls: Call[], part: string) =>
  calls.filter((c) => c.url.includes(part)).map((c) => c.url);

describe('MedicalRecordsPage: hai chế độ, bộ lọc trên URL (spec B, mục 8.5)', () => {
  it('mặc định mở chế độ cột (D-B25): Chờ tiếp nhận, Đang khám, Hoàn tất; Nháp thu gọn; chưa có bảng', async () => {
    setup();
    const pending = await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });
    expect(
      await within(pending).findByRole('article', { name: 'Bệnh án #101' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cột Đang khám' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cột Hoàn tất' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở cột Nháp (0)' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('bấm "Bảng" → view=table trên URL, hiện tab có số đếm; mở thẳng URL view=table&status=pending → đúng tab', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });

    await user.click(screen.getByText('Bảng'));

    expect(await screen.findByRole('tab', { name: 'Tất cả (3)' })).toBeInTheDocument();
    expect(url()).toBe('?view=table');
    expect(screen.queryByRole('region', { name: 'Cột Chờ tiếp nhận' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Chờ tiếp nhận (1)' }));
    await waitFor(() => expect(url()).toBe('?view=table&status=pending'));
    await waitFor(() =>
      expect(urlsOf(calls, '/medical_records/all').at(-1)).toBe(
        `${BASE}/medical_records/all?status=pending&page=1&limit=20`,
      ),
    );
  });

  it('mở URL view=table&status=pending&type=MAN → bảng, tab Chờ tiếp nhận, lọc loại', async () => {
    const calls = setup('/medical-records?view=table&status=pending&type=MAN');
    expect(await screen.findByRole('tab', { name: 'Chờ tiếp nhận (1)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(urlsOf(calls, '/medical_records/all')[0]).toBe(
      `${BASE}/medical_records/all?record_type=MAN&status=pending&page=1&limit=20`,
    );
  });

  it('bộ lọc chung trên URL: loại Cấp → type=CAP; "Tôi phụ trách" → mine=1, doctor_id = người đăng nhập', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });

    await user.click(screen.getByLabelText('Lọc theo loại bệnh án'));
    await user.click(await screen.findByTitle('Cấp'));
    await waitFor(() => expect(url()).toBe('?view=board&type=CAP'));
    await user.click(screen.getByRole('checkbox', { name: 'Tôi phụ trách' }));
    await waitFor(() => expect(url()).toBe('?view=board&type=CAP&mine=1'));

    await waitFor(() =>
      expect(urlsOf(calls, '/medical_records/status-counts').at(-1)).toBe(
        `${BASE}/medical_records/status-counts?record_type=CAP&doctor_id=1`,
      ),
    );
    expect(urlsOf(calls, 'status=pending').at(-1)).toContain(
      'record_type=CAP&doctor_id=1&status=pending',
    );
  });

  it('chế độ bảng: đang ở trang 2 mà đổi bộ lọc loại → lời gọi danh sách kế tiếp về page=1', async () => {
    const calls = setup('/medical-records?view=table', 45);
    const user = userEvent.setup();
    await screen.findByRole('tab', { name: 'Tất cả (3)' });
    await user.click(await screen.findByText('2', { selector: '.ant-pagination-item a' }));
    await waitFor(() => expect(urlsOf(calls, '/medical_records/all').at(-1)).toContain('page=2'));

    const before = urlsOf(calls, '/medical_records/all').length;
    await user.click(screen.getByLabelText('Lọc theo loại bệnh án'));
    await user.click(await screen.findByTitle('Cấp'));

    await waitFor(() =>
      expect(urlsOf(calls, '/medical_records/all').slice(before)).toContain(
        `${BASE}/medical_records/all?record_type=CAP&page=1&limit=20`,
      ),
    );
    expect(urlsOf(calls, '/medical_records/all').slice(before)).not.toContainEqual(
      expect.stringContaining('record_type=CAP&page=2'),
    );
  });

  it('"Hiện bệnh án đã huỷ" chỉ ở chế độ cột; bật thì có cột Đã huỷ', async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });
    expect(screen.queryByRole('region', { name: 'Cột Đã huỷ' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Hiện bệnh án đã huỷ' }));
    expect(await screen.findByRole('region', { name: 'Cột Đã huỷ' })).toBeInTheDocument();

    await user.click(screen.getByText('Bảng'));
    await screen.findByRole('tab', { name: 'Tất cả (3)' });
    expect(screen.queryByRole('switch', { name: 'Hiện bệnh án đã huỷ' })).not.toBeInTheDocument();
  });

  it('"Tạo bệnh án" mở hộp tạo có ô tìm bệnh nhân', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tạo bệnh án' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Bệnh nhân')).toBeEnabled();
    expect(within(dialog).getByText('Không đổi được sau khi tạo')).toBeInTheDocument();
  });
});
