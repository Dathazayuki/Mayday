import { App, ConfigProvider } from 'antd';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { chronicVisit } from '../../../test/clinical-fixture';
import { errorResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { AddVisitModal } from './AddVisitModal';

const BASE = 'http://localhost:3000/api/v1';

const ROOMS = [{ id: '2', name: 'Phòng khám 2', branch_id: '1' }];
const BRANCHES = [{ id: '1', name: 'Chi nhánh dev', address: null, phone: null }];

type Call = { method: string; url: string; body?: string };

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở hộp
      </button>
      <AddVisitModal recordId={12} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function setup(post: () => Response = () => okResponse(chronicVisit({ visit_number: 3 }))) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      if (route === 'POST /medical_records/12/visits') return Promise.resolve(post());
      if (route === 'GET /rooms') return Promise.resolve(okResponse(ROOMS));
      return Promise.resolve(okResponse(BRANCHES));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Harness />
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const posts = (calls: Call[]) =>
  calls
    .filter((call) => call.method === 'POST')
    .map((call) => ({ url: call.url.replace(BASE, ''), body: JSON.parse(call.body ?? '{}') }));

describe('AddVisitModal (spec B, mục 8.7)', () => {
  it('không chọn phòng: POST /medical_records/:id/visits với body rỗng (ngày khám = hôm nay của API)', async () => {
    const user = userEvent.setup();
    const calls = setup();
    await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
    expect(await screen.findByText(/ngày khám hôm nay/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thêm phiên khám' }));
    expect(await screen.findByText('Đã thêm phiên khám')).toBeInTheDocument();
    expect(posts(calls)).toEqual([{ url: '/medical_records/12/visits', body: {} }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('chọn phòng: gửi room_id (MT-115)', async () => {
    const user = userEvent.setup();
    const calls = setup();
    await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
    await user.click(await screen.findByLabelText('Phòng khám'));
    const options = await screen.findAllByTitle('Phòng khám 2 · Chi nhánh dev');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: 'Thêm phiên khám' }));
    await waitFor(() =>
      expect(posts(calls)).toEqual([{ url: '/medical_records/12/visits', body: { room_id: 2 } }]),
    );
  });

  it('lỗi API (3105): báo bằng describeError, hộp vẫn mở', async () => {
    const user = userEvent.setup();
    setup(() => errorResponse(403, '3105'));
    await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
    await user.click(await screen.findByRole('button', { name: 'Thêm phiên khám' }));
    expect(await screen.findByText('Bác sĩ không phụ trách bệnh án này')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
