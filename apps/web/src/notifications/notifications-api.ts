import {
  LIMIT_DEFAULT,
  NOTIFICATION_PATHS,
  type NotificationData,
  type PageResult,
} from '@drmayday/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const NOTIFICATIONS_KEY = ['notifications'] as const;
const REFETCH_MS = 60_000;

/** Trang đầu thông báo (mới nhất trước); tự làm mới mỗi 60 giây khi cửa sổ đang được chú ý. */
export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () =>
      apiClient.getPage<NotificationData>(NOTIFICATION_PATHS.list, {
        page: 1,
        limit: LIMIT_DEFAULT,
      }),
    // Chuông nằm trong thanh trên của từng Page nên gắn lại mỗi lần đổi trang; dữ liệu coi là mới
    // trong suốt chu kỳ làm mới để việc điều hướng không tạo thêm một lần gọi API.
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

/** Đánh dấu đã đọc, cập nhật lạc quan và hoàn lại khi lỗi. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put<NotificationData>(NOTIFICATION_PATHS.markRead(id)),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<PageResult<NotificationData>>(NOTIFICATIONS_KEY);
      if (previous) {
        queryClient.setQueryData<PageResult<NotificationData>>(NOTIFICATIONS_KEY, {
          ...previous,
          items: previous.items.map((n) => (n.id === id ? { ...n, is_read: '1' } : n)),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATIONS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<unknown>(NOTIFICATION_PATHS.remove(id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
