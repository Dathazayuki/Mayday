import { render, screen, waitFor } from '@testing-library/react';
import { UNAUTHENTICATED_EVENT } from '../../api';
import { imageResponse, jsonResponse, seedSession } from '../../test/helpers';
import { AuthorizedImage } from './AuthorizedImage';

const FILE_URL = '/api/v1/image-attachments/view/5';
const FULL_URL = `http://localhost:3000${FILE_URL}`;

describe('AuthorizedImage', () => {
  const createObjectURL = vi.fn(() => 'blob:image-1');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear().mockReturnValue('blob:image-1');
    revokeObjectURL.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    seedSession();
  });

  it('gọi fetch kèm Bearer token và hiện ảnh bằng object URL', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(imageResponse()));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthorizedImage fileUrl={FILE_URL} alt="Ảnh ngứa" />);
    const img = await screen.findByRole('img', { name: 'Ảnh ngứa' });
    expect(img).toHaveAttribute('src', 'blob:image-1');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FULL_URL);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-token');
  });

  it('unmount thì thu hồi object URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(imageResponse())),
    );
    const { unmount } = render(<AuthorizedImage fileUrl={FILE_URL} alt="Ảnh" />);
    await screen.findByRole('img', { name: 'Ảnh' });
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:image-1');
  });

  it('response lỗi (403, 3106) thì hiện "Không tải được ảnh"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(403, { code: '3106', message: 'x' }))),
    );
    render(<AuthorizedImage fileUrl={FILE_URL} alt="Ảnh" />);
    expect(await screen.findByText('Không tải được ảnh')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    ['origin khác', 'https://cdn.example.com/a.jpg'],
    ['protocol-relative', '//evil.example/a.jpg'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/png;base64,AAAA'],
  ])('file_url ngoài API (%s) thì hiện lỗi và không gọi fetch', async (_name, fileUrl) => {
    const fetchMock = vi.fn(() => Promise.resolve(imageResponse()));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthorizedImage fileUrl={fileUrl} alt="Ảnh" />);
    expect(await screen.findByText('Không tải được ảnh')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('URL tuyệt đối cùng origin với API vẫn tải kèm token', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(imageResponse()));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthorizedImage fileUrl={FULL_URL} alt="Ảnh" />);
    await screen.findByRole('img', { name: 'Ảnh' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FULL_URL);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-token');
  });

  it('đổi fileUrl thì huỷ request cũ', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Promise<Response>(() => undefined);
      }),
    );
    const { rerender } = render(<AuthorizedImage fileUrl={FILE_URL} alt="Ảnh" />);
    await waitFor(() => expect(signals).toHaveLength(1));
    rerender(<AuthorizedImage fileUrl="/api/v1/image-attachments/view/6" alt="Ảnh" />);
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it.each([
    ['HTTP 401', () => new Response('', { status: 401 })],
    ['JSON 3002', () => jsonResponse(403, { code: '3002', message: 'x' })],
  ])('phiên hết hạn (%s) thì phát sự kiện đăng xuất', async (_name, response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response())),
    );
    const listener = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);
    render(<AuthorizedImage fileUrl={FILE_URL} alt="Ảnh" />);
    expect(await screen.findByText('Không tải được ảnh')).toBeInTheDocument();
    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('lỗi 3106 không phải hết phiên nên không phát sự kiện đăng xuất', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(403, { code: '3106', message: 'x' }))),
    );
    const listener = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);
    render(<AuthorizedImage fileUrl={FILE_URL} alt="Ảnh" />);
    await screen.findByText('Không tải được ảnh');
    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
