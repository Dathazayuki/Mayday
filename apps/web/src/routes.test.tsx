import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UNAUTHENTICATED_EVENT } from './api';
import { AppRoutes } from './routes';
import { errorResponse, jsonResponse, okResponse, renderApp, seedSession } from './test/helpers';

function renderAt(path: string) {
  return renderApp(<AppRoutes />, path);
}

async function submitLogin(phone: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Số điện thoại'), phone);
  await user.type(screen.getByLabelText('Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));
}

describe('Định tuyến và đăng nhập', () => {
  it('chưa đăng nhập mà vào trang trong thì chuyển về trang đăng nhập', () => {
    renderAt('/medical-records');
    expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
  });

  it.each(['/profile', '/change-password'])(
    'chưa đăng nhập mà vào %s thì chuyển về trang đăng nhập',
    (path) => {
      renderAt(path);
      expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
    },
  );

  it('báo lỗi ngay tại client khi số điện thoại sai định dạng, không gọi API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');

    await submitLogin('12345', 'matkhau123');

    expect(await screen.findByText(/Số điện thoại không đúng định dạng/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hiển thị lỗi tiếng Việt khi API trả 3008', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: '3008', message: 'Password incorrect' })),
    );
    renderAt('/login');

    await submitLogin('0912345678', 'sai-mat-khau');

    expect(await screen.findByText('Mật khẩu không chính xác')).toBeInTheDocument();
  });

  it('đăng nhập thành công thì vào trang tổng quan và hiện tên người dùng', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '1000',
        message: 'OK',
        data: {
          token: 'jwt-token',
          user_info: {
            user_id: '1',
            full_name: 'Nguyễn Văn An',
            phone: '0912345678',
            role_id: '2',
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');

    await submitLogin('0912345678', 'matkhau123');

    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/auth/login');
    expect(init.body).toBe(JSON.stringify({ phone: '0912345678', password: 'matkhau123' }));
  });

  it('API báo hết phiên (3001/3002/3003) thì đăng xuất và về trang đăng nhập', async () => {
    localStorage.setItem('drmayday.token', 'jwt-token');
    localStorage.setItem(
      'drmayday.user',
      JSON.stringify({
        user_id: '1',
        full_name: 'Nguyễn Văn An',
        phone: '0912345678',
        role_id: '2',
      }),
    );
    // Không stub thì fetch thật chạm API đang chạy ở máy dev và trả 401 muộn, làm hỏng test kế tiếp.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderAt('/');
    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    });

    expect(await screen.findByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });

  it('menu người dùng có Hồ sơ cá nhân, Đổi mật khẩu và Đăng xuất (gọi API rồi về đăng nhập)', async () => {
    seedSession();
    // Chuông thông báo ở header tải danh sách phân trang nên /notifications phải trả mảng.
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/notifications')
          ? jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 })
          : okResponse(),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/');
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText(/Tài khoản/));
    expect(await screen.findByText('Hồ sơ cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Đổi mật khẩu')).toBeInTheDocument();
    await user.click(screen.getByText('Đăng xuất'));

    expect(await screen.findByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls).toContain('http://localhost:3000/api/v1/auth/logout');
  });

  it('đang đăng xuất thì không cho bấm Đăng xuất lần nữa (không gọi API hai lần)', async () => {
    seedSession();
    const fetchMock = vi.fn((..._args: unknown[]) => new Promise<Response>(() => undefined)); // mọi lời gọi treo
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/');
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText(/Tài khoản/));
    await user.click(await screen.findByText('Đăng xuất'));
    // Nút người dùng chuyển sang trạng thái loading nên không mở lại được menu để bấm lần hai.
    const trigger = screen.getByLabelText(/Tài khoản/);
    expect(trigger).toHaveClass('ant-btn-loading');
    await user.click(trigger);
    const logoutCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/logout'),
    );
    expect(logoutCalls).toHaveLength(1);
  });

  it('menu "Quản trị hệ thống" hiện với admin (GET /roles thành công)', async () => {
    seedSession();
    // Mỗi lời gọi phải trả Response mới: body của một Response chỉ đọc được một lần.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/');
    expect(await screen.findByText('Quản trị hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Cơ sở vật chất')).toBeInTheDocument();
  });

  it('menu "Quản trị hệ thống" ẩn khi không phải admin (3102), vẫn còn phiên', async () => {
    seedSession();
    const fetchMock = vi.fn(() => Promise.resolve(errorResponse(403, '3102')));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/');
    expect(await screen.findByText('Khám và điều trị')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText('Quản trị hệ thống')).not.toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
  });

  it('không phải admin vào /admin/users thì thấy 403 nhưng vẫn còn thanh trên (menu, tài khoản)', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(errorResponse(403, '3102'))),
    );
    renderAt('/admin/users');
    expect(await screen.findByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tài khoản:/)).toBeInTheDocument();
    expect(screen.getByLabelText('Mở menu')).toBeInTheDocument();
  });

  it('menu "Khám và điều trị" ẩn với bệnh nhân (hồ sơ có trường bệnh nhân)', async () => {
    seedSession();
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        String(url).endsWith('/profile')
          ? okResponse({ user_id: 1, full_name: 'Nguyễn Văn An', year_of_birth: 1990 })
          : errorResponse(403, '3102'),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Khám và điều trị')).not.toBeInTheDocument());
  });

  it('vào /medical-records hiện danh sách bệnh án thay vì trang "Sắp ra mắt"', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/medical-records');
    expect(await screen.findByText('Tất cả trạng thái')).toBeInTheDocument();
  });

  it('vào /patients hiện trang tìm bệnh nhân', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/patients');
    expect(await screen.findByRole('button', { name: 'Thêm bệnh nhân' })).toBeInTheDocument();
  });

  it('vào /medical-records/:id hiện màn khám của bệnh án', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          String(url).endsWith('/medical_records/5')
            ? okResponse({
                medical_record_id: 5,
                patient_id: 7,
                assigned_doctor_id: null,
                created_by: 7,
                template_id: null,
                status: 'pending',
                instructions: null,
                completed_at: null,
                created_at: '2026-11-15T08:00:00.000Z',
                updated_at: '2026-11-15T08:00:00.000Z',
              })
            : okResponse([]),
        ),
      ),
    );
    renderAt('/medical-records/5');
    expect(await screen.findByText('Bệnh án #5')).toBeInTheDocument();
    expect(await screen.findByText('Bệnh án chưa gắn mẫu phiếu')).toBeInTheDocument();
  });

  it('vào /admin/facilities hiện trang quản lý cơ sở vật chất', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/admin/facilities');
    expect(await screen.findByRole('tab', { name: 'Chi nhánh' })).toBeInTheDocument();
  });
  it('không phải admin vào /admin/facilities thì thấy 403, không có trang quản lý', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(errorResponse(403, '3102'))),
    );
    renderAt('/admin/facilities');
    expect(await screen.findByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Chi nhánh' })).not.toBeInTheDocument();
  });

  it('đang xác định vai trò thì /admin/facilities hiện spinner, chưa lộ trang và chưa báo 403', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = renderAt('/admin/facilities');
    await screen.findByText('Nguyễn Văn An');
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
    expect(screen.queryByText('Bạn không có quyền truy cập trang này')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Chi nhánh' })).not.toBeInTheDocument();
  });

  it('menu "Quản trị hệ thống" không còn mục "Mẫu phiếu khám" (spec A, mục 7.1)', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/');
    expect(await screen.findByText('Quản trị hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Mẫu phiếu khám')).not.toBeInTheDocument();
  });

  it.each(['/admin/templates', '/admin/templates/TMPL_URT'])(
    'vào %s (đã gỡ) hiện trang không tìm thấy',
    async (path) => {
      seedSession();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(okResponse([]))),
      );
      renderAt(path);
      expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
    },
  );
});
