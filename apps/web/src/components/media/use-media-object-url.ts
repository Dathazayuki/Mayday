import { resolveMediaUrl } from '@drmayday/shared';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../api';
import { authStorage } from '../../auth/auth-storage';

type Result = { status: 'loading' } | { status: 'error' } | { status: 'ready'; objectUrl: string };

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
    const token = authStorage.getToken();

    fetch(resolveMediaUrl(API_BASE_URL, fileUrl), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
