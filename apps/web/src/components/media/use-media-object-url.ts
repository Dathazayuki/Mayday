import { resolveMediaUrl, UNAUTHENTICATED_CODES } from '@drmayday/shared';
import { useEffect, useState } from 'react';
import { API_BASE_URL, authHeaders, notifyUnauthenticated } from '../../api';

type Result = { status: 'loading' } | { status: 'error' } | { status: 'ready'; objectUrl: string };

/** 401 hoặc JSON lỗi 3001/3002/3003: giống luồng hết phiên của api client. */
async function isSessionExpired(response: Response): Promise<boolean> {
  if (response.status === 401) return true;
  try {
    const body = (await response.json()) as { code?: string };
    return (UNAUTHENTICATED_CODES as readonly (string | undefined)[]).includes(body.code);
  } catch {
    return false;
  }
}

/**
 * Tải ảnh từ endpoint view (cần Bearer token, MT-85) thành object URL để gán cho `<img>`.
 * Đổi `fileUrl` hoặc unmount thì huỷ request đang chạy và thu hồi object URL.
 */
export function useMediaObjectUrl(fileUrl: string): Result {
  // Kết quả gắn với fileUrl đã tải; fileUrl mới chưa có kết quả thì coi là đang tải.
  const [loaded, setLoaded] = useState<{ fileUrl: string; result: Result }>();

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    fetch(resolveMediaUrl(API_BASE_URL, fileUrl), {
      headers: authHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          if (await isSessionExpired(response)) notifyUnauthenticated();
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ fileUrl, result: { status: 'ready', objectUrl } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ fileUrl, result: { status: 'error' } });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  return loaded?.fileUrl === fileUrl ? loaded.result : { status: 'loading' };
}
