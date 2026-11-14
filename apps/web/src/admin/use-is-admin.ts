import { ApiError, type RoleData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Mã "chỉ dành cho Admin" (3102). */
const ADMIN_REQUIRED_CODE = '3102';

/**
 * Nhận ra admin bằng cách thử GET /roles (spec mục 5): thành công → true, 3102 → false,
 * đang tải → undefined, lỗi khác → false. Cache xoá khi đăng xuất (AuthProvider).
 */
export function useIsAdmin(): boolean | undefined {
  const { isSuccess, isError } = useQuery({
    queryKey: ['roles', 'is-admin'],
    queryFn: () => apiClient.get<RoleData[]>('/roles'),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.code === ADMIN_REQUIRED_CODE) && failureCount < 1,
    staleTime: Infinity,
  });
  if (isSuccess) return true;
  if (isError) return false;
  return undefined;
}
