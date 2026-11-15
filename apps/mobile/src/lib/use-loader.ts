import { describeError } from '@drmayday/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export interface Loader<T> {
  /** null khi chưa tải xong hoặc tải lỗi lần đầu. */
  data: T | null;
  error: string | null;
  /** Kéo để làm mới đang chạy. */
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Tải dữ liệu mỗi lần màn hình được mở (và khi `fetcher` đổi). Chỉ nhận kết quả của lần tải mới
 * nhất, tránh phản hồi cũ về muộn ghi đè. `fetcher` phải ổn định (useCallback).
 */
export function useLoader<T>(fetcher: () => Promise<T>): Loader<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setError(null);
    try {
      const result = await fetcher();
      if (requestId === latestRequest.current) setData(result);
    } catch (e) {
      if (requestId === latestRequest.current) setError(describeError(e));
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  return { data, error, refreshing, reload, refresh };
}
