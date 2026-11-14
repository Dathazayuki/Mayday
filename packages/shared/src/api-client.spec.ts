import { buildUrl, createApiClient } from './api-client.js';
import { ApiError, NETWORK_ERROR_CODE } from './api-types.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type FetchCall = [string, RequestInit & { headers: Record<string, string> }];

describe('buildUrl', () => {
  it('ghép baseUrl, tiền tố /api/v1, path và query, bỏ giá trị rỗng', () => {
    expect(
      buildUrl('http://localhost:3000/', '/doctor/patients/search', {
        keyword: 'An',
        page: 1,
        gender: undefined,
        limit: null,
      }),
    ).toBe('http://localhost:3000/api/v1/doctor/patients/search?keyword=An&page=1');
  });
});

describe('createApiClient', () => {
  it('gắn Bearer token và trả về data khi code là 1000', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { code: '1000', message: 'OK', data: { id: 1 } }));
    const client = createApiClient({ baseUrl: 'http://api', getToken: () => 'abc', fetchImpl });

    await expect(client.get<{ id: number }>('/profile')).resolves.toEqual({ id: 1 });

    const [url, init] = fetchImpl.mock.calls[0] as FetchCall;
    expect(url).toBe('http://api/api/v1/profile');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('gửi body JSON và chấp nhận mã 1001', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(201, { code: '1001', message: 'Created successfully', data: { user_id: 7 } }),
    );
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.post('/auth/signup', { phone: '0912345678' })).resolves.toEqual({
      user_id: 7,
    });

    const [, init] = fetchImpl.mock.calls[0] as FetchCall;
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ phone: '0912345678' }));
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('ném ApiError mang code, message, HTTP status và data của server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(409, {
        code: '3006',
        message: 'User phone or email already exists',
        data: { field: 'phone' },
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    const error = await client.post('/auth/signup', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: '3006',
      message: 'User phone or email already exists',
      httpStatus: 409,
      data: { field: 'phone' },
    });
  });

  it('gọi onUnauthenticated khi nhận mã 3001/3002/3003', async () => {
    const onUnauthenticated = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { code: '3002', message: 'Token expired' }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl, onUnauthenticated });

    await expect(client.get('/profile')).rejects.toMatchObject({ code: '3002' });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('không gọi onUnauthenticated với lỗi khác (3008 sai mật khẩu)', async () => {
    const onUnauthenticated = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { code: '3008', message: 'Password incorrect' }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl, onUnauthenticated });

    await expect(client.post('/auth/login', {})).rejects.toMatchObject({ code: '3008' });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('trả NETWORK_ERROR khi không gọi được máy chủ', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.get('/health')).rejects.toMatchObject({
      code: NETWORK_ERROR_CODE,
      httpStatus: 0,
    });
  });

  it('trả 9901 khi response không phải JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.get('/health')).rejects.toMatchObject({ code: '9901', httpStatus: 502 });
  });
});

describe('timeout của request', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** fetch không bao giờ trả về, chỉ reject khi signal bị abort. */
  function hangingFetch(): typeof fetch {
    return vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    ) as unknown as typeof fetch;
  }

  it('hết giờ theo timeoutMs của lệnh gọi và trả NETWORK_ERROR', async () => {
    vi.useFakeTimers();
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl: hangingFetch() });

    let settled = false;
    const result = client
      .post('/auth/logout', undefined, { timeoutMs: 5000 })
      .catch((e: unknown) => e)
      .finally(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({
      code: NETWORK_ERROR_CODE,
      message: 'Request timed out',
      httpStatus: 0,
    });
  });

  it('dùng timeoutMs của client khi lệnh gọi không truyền timeout', async () => {
    vi.useFakeTimers();
    const client = createApiClient({
      baseUrl: 'http://api',
      fetchImpl: hangingFetch(),
      timeoutMs: 1000,
    });

    let settled = false;
    const result = client
      .get('/profile')
      .catch((e: unknown) => e)
      .finally(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ code: NETWORK_ERROR_CODE });
  });

  it('xoá timer sau khi nhận response thành công', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { code: '1000', message: 'OK', data: { id: 1 } }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.get('/profile')).resolves.toEqual({ id: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('truyền AbortSignal cho fetchImpl', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { code: '1000', message: 'OK', data: null }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await client.get('/profile');

    const [, init] = fetchImpl.mock.calls[0] as FetchCall;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
