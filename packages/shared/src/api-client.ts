import { API_PREFIX, ApiError, NETWORK_ERROR_CODE, type ApiResponse } from './api-types.js';
import { SUCCESS_CODES, UNAUTHENTICATED_CODES } from './response-codes.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Gọi khi server trả 3001/3002/3003 – client nên xoá phiên đăng nhập. */
  onUnauthenticated?: (error: ApiError) => void;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
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

  async function request<T>(
    method: HttpMethod,
    path: string,
    { query, body }: RequestOptions = {},
  ): Promise<T> {
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

    let response: Response;
    try {
      response = await fetchImpl(buildUrl(options.baseUrl, path, query), {
        method,
        headers,
        body: payload,
      });
    } catch (cause) {
      throw new ApiError(NETWORK_ERROR_CODE, 'Network request failed', 0, cause);
    }

    let envelope: Partial<ApiResponse<T>>;
    try {
      envelope = (await response.json()) as Partial<ApiResponse<T>>;
    } catch {
      throw new ApiError('9901', 'Internal server error', response.status);
    }

    const code = typeof envelope.code === 'string' ? envelope.code : '9901';
    if ((SUCCESS_CODES as readonly string[]).includes(code)) return envelope.data as T;

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

  return {
    request,
    get<T>(path: string, query?: Record<string, QueryValue>) {
      return request<T>('GET', path, { query });
    },
    post<T>(path: string, body?: unknown) {
      return request<T>('POST', path, { body });
    },
    put<T>(path: string, body?: unknown) {
      return request<T>('PUT', path, { body });
    },
    patch<T>(path: string, body?: unknown) {
      return request<T>('PATCH', path, { body });
    },
    delete<T>(path: string) {
      return request<T>('DELETE', path);
    },
  };
}
