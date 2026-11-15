import { describeError, ApiError } from '@drmayday/shared';
import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorResponse, okResponse, renderApp, seedSession } from '../test/helpers';
import { ProfilePage } from './ProfilePage';

const STAFF_PROFILE = {
  user_id: 1,
  full_name: 'NGUYỄN VĂN AN',
  phone: '0912345678',
  role_id: 2,
  gender: 'male',
};

const PATIENT_PROFILE = {
  ...STAFF_PROFILE,
  role_id: 5,
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: null,
  commune_address: 'Xã A',
  city_address: 'Hà Nội',
  work_place: null,
  health_insurance_number: 'DN4010123456789',
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: 'Trần Thị B',
  next_of_kin_phone: '0987654321',
  first_visit: '2026-01-05T08:00:00.000Z',
};

function renderPage() {
  seedSession();
  renderApp(<ProfilePage />);
}

describe('ProfilePage', () => {
  it('hiển thị dữ liệu từ GET /profile kèm Bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(STAFF_PROFILE));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    expect(await screen.findByLabelText('Họ và tên')).toHaveValue('NGUYỄN VĂN AN');
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue('0912345678');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/profile');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
  });

  it('nhân viên chỉ thấy họ tên, số điện thoại, giới tính', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(STAFF_PROFILE)));
    renderPage();

    await screen.findByLabelText('Họ và tên');
    expect(screen.getByLabelText('Số điện thoại')).toBeDisabled();
    expect(screen.getByText('Giới tính')).toBeInTheDocument();
    expect(screen.queryByLabelText('Năm sinh')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dân tộc')).not.toBeInTheDocument();
    expect(screen.queryByText('Lần khám đầu tiên')).not.toBeInTheDocument();
  });

  it('bệnh nhân thấy đủ các trường, kể cả lần khám đầu tiên (chỉ đọc)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(PATIENT_PROFILE)));
    renderPage();

    expect(await screen.findByLabelText('Năm sinh')).toHaveValue('1990');
    expect(screen.getByText('Nghề nghiệp')).toBeInTheDocument();
    expect(screen.getByLabelText('Dân tộc')).toHaveValue('Kinh');
    expect(screen.getByLabelText('Số thẻ BHYT')).toHaveValue('DN4010123456789');
    expect(screen.getByLabelText('Hạn thẻ BHYT')).toHaveValue('2027-12-31');
    expect(screen.getByLabelText('Số điện thoại người thân')).toHaveValue('0987654321');
    expect(screen.getByText('Lần khám đầu tiên')).toBeInTheDocument();
  });

  it('sửa họ tên rồi Lưu: PUT chỉ gửi trường đã đổi, hiện thông báo và dữ liệu mới', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(STAFF_PROFILE))
      .mockResolvedValueOnce(okResponse({ ...STAFF_PROFILE, full_name: 'LÊ VĂN BÌNH' }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    const input = await screen.findByLabelText('Họ và tên');
    await user.clear(input);
    await user.type(input, 'Lê Văn Bình');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu hồ sơ')).toBeInTheDocument();
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('LÊ VĂN BÌNH');
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/profile');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ full_name: 'Lê Văn Bình' }));
  });

  it('xoá trống một trường văn bản của bệnh nhân thì gửi null', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(PATIENT_PROFILE))
      .mockResolvedValueOnce(okResponse({ ...PATIENT_PROFILE, ethnic: null }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    await user.clear(await screen.findByLabelText('Dân tộc'));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu hồ sơ')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ ethnic: null }));
  });

  it('họ tên để trống: báo lỗi tại form, không gọi PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(STAFF_PROFILE));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    await user.clear(await screen.findByLabelText('Họ và tên'));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Vui lòng nhập họ và tên')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hạn BHYT sai định dạng: báo lỗi tại form, không gọi PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(PATIENT_PROFILE));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    const input = await screen.findByLabelText('Hạn thẻ BHYT');
    await user.clear(input);
    await user.type(input, '31/12/2027');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText(/Ngày không đúng định dạng/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('không có thay đổi thì báo và không gọi PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(STAFF_PROFILE));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await screen.findByLabelText('Họ và tên');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Chưa có thay đổi nào để lưu')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('API trả 2003 thì hiển thị bằng describeError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(STAFF_PROFILE))
      .mockResolvedValueOnce(errorResponse(400, '2003'));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Họ và tên'), ' X');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      describeError(new ApiError('2003', 'error', 400)),
    );
    expect(screen.queryByText('Đã lưu hồ sơ')).not.toBeInTheDocument();
  });

  it('năm sinh ngoài khoảng cho phép: báo lỗi tại form, không gọi PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(PATIENT_PROFILE));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    const input = await screen.findByLabelText('Năm sinh');
    await user.clear(input);
    await user.type(input, '1800');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Năm sinh không hợp lệ')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('chọn giới tính mới thì PUT gửi gender', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(STAFF_PROFILE))
      .mockResolvedValueOnce(okResponse({ ...STAFF_PROFILE, gender: 'female' }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Giới tính'));
    await user.click(await screen.findByTitle('Nữ'));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu hồ sơ')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ gender: 'female' }));
  });

  it('chọn nghề nghiệp mới thì PUT gửi career', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(PATIENT_PROFILE))
      .mockResolvedValueOnce(okResponse({ ...PATIENT_PROFILE, career: 'Nong dan' }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Nghề nghiệp'));
    await user.click(await screen.findByTitle('Nông dân'));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu hồ sơ')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ career: 'Nong dan' }));
  });

  it('refetch nền không làm trường chưa sửa bị coi là đã đổi (không ghi đè dữ liệu server)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(PATIENT_PROFILE))
      // Lần refetch: server đã có thành phố mới do nơi khác sửa.
      .mockResolvedValueOnce(okResponse({ ...PATIENT_PROFILE, city_address: 'Huế' }))
      .mockResolvedValueOnce(
        okResponse({ ...PATIENT_PROFILE, city_address: 'Huế', ethnic: 'Tày' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    seedSession();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderApp(<ProfilePage />, '/', queryClient);
    const user = userEvent.setup();

    const ethnic = await screen.findByLabelText('Dân tộc');
    await act(() => queryClient.refetchQueries({ queryKey: ['profile'] }));
    await user.clear(ethnic);
    await user.type(ethnic, 'Tày');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu hồ sơ')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ ethnic: 'Tày' }));
  });
});
