import {
  API_PREFIX,
  ApiError,
  DEFAULT_TIMEOUT_MS,
  NETWORK_ERROR_CODE,
  type ApiResponse,
  type PageResult,
} from './api-types.js';
import { SUCCESS_CODES, UNAUTHENTICATED_CODES } from './response-codes.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export interface CallOptions {
  /** Thời gian chờ riêng cho lệnh gọi này (ms), ghi đè timeoutMs của client. */
  timeoutMs?: number;
}

export interface RequestOptions extends CallOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Gọi khi server trả 3001/3002/3003 – client nên xoá phiên đăng nhập. */
  onUnauthenticated?: (error: ApiError) => void;
  fetchImpl?: typeof fetch;
  /** Thời gian chờ mặc định cho mọi request (ms). */
  timeoutMs?: number;
}

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, query?: Record<string, QueryValue>, options?: CallOptions): Promise<T>;
  getPage<T>(
    path: string,
    query?: Record<string, QueryValue>,
    options?: CallOptions,
  ): Promise<PageResult<T>>;
  post<T>(path: string, body?: unknown, options?: CallOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: CallOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: CallOptions): Promise<T>;
  delete<T>(path: string, options?: CallOptions): Promise<T>;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl.replace(/\/+$/, '')}${API_PREFIX}${normalizedPath}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function send<T>(
    method: HttpMethod,
    path: string,
    { query, body, timeoutMs }: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    // Hết giờ thì abort fetch; timer luôn được xoá ở finally (kể cả khi đọc body).
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    let response: Response;
    let envelope: Partial<ApiResponse<T>>;
    try {
      try {
        response = await fetchImpl(buildUrl(options.baseUrl, path, query), {
          method,
          headers,
          body: payload,
          signal: controller.signal,
        });
      } catch (cause) {
        throw timedOut
          ? new ApiError(NETWORK_ERROR_CODE, 'Request timed out', 0)
          : new ApiError(NETWORK_ERROR_CODE, 'Network request failed', 0, cause);
      }

      try {
        envelope = (await response.json()) as Partial<ApiResponse<T>>;
      } catch {
        throw timedOut
          ? new ApiError(NETWORK_ERROR_CODE, 'Request timed out', 0)
          : new ApiError('9901', 'Internal server error', response.status);
      }
    } finally {
      clearTimeout(timer);
    }

    const code = typeof envelope.code === 'string' ? envelope.code : '9901';
    if ((SUCCESS_CODES as readonly string[]).includes(code)) {
      return { ...envelope, code, message: envelope.message ?? '' } as ApiResponse<T>;
    }

    const error = new ApiError(
      code,
      envelope.message ?? 'Internal server error',
      response.status,
      envelope.data,
    );
    if ((UNAUTHENTICATED_CODES as readonly string[]).includes(code)) {
      options.onUnauthenticated?.(error);
    }
    throw error;
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<T> {
    const envelope = await send<T>(method, path, requestOptions);
    return envelope.data as T;
  }

  return {
    request,
    get<T>(path: string, query?: Record<string, QueryValue>, options?: CallOptions) {
      return request<T>('GET', path, { query, ...options });
    },
    async getPage<T>(
      path: string,
      query?: Record<string, QueryValue>,
      options?: CallOptions,
    ): Promise<PageResult<T>> {
      const envelope = await send<T[]>('GET', path, { query, ...options });
      return { items: envelope.data ?? [], total: Number(envelope.total ?? 0) };
    },
    post<T>(path: string, body?: unknown, options?: CallOptions) {
      return request<T>('POST', path, { body, ...options });
    },
    put<T>(path: string, body?: unknown, options?: CallOptions) {
      return request<T>('PUT', path, { body, ...options });
    },
    patch<T>(path: string, body?: unknown, options?: CallOptions) {
      return request<T>('PATCH', path, { body, ...options });
    },
    delete<T>(path: string, options?: CallOptions) {
      return request<T>('DELETE', path, { ...options });
    },
  };
}
