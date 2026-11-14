import { ApiError } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchRoles, ROLES_KEY } from './rbac-api';

/** Khoá riêng (con của ROLES_KEY) để nhận ra admin với retry/staleTime riêng, tách khỏi danh sách hiển thị. */
const IS_ADMIN_KEY = [...ROLES_KEY, 'is-admin'] as const;

/** Mã "chỉ dành cho Admin" (3102). */
const ADMIN_REQUIRED_CODE = '3102';

/**
 * Nhận ra admin bằng cách thử GET /roles (spec mục 5): đã có dữ liệu → true (kể cả khi lần làm mới
 * sau đó lỗi), chưa có dữ liệu mà lỗi (3102 hoặc lỗi khác) → false, đang tải → undefined.
 * Cache xoá khi đăng xuất (AuthProvider).
 */
export function useIsAdmin(): boolean | undefined {
  const { data, isError } = useQuery({
    queryKey: IS_ADMIN_KEY,
    queryFn: fetchRoles,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.code === ADMIN_REQUIRED_CODE) && failureCount < 1,
    staleTime: Infinity,
  });
  if (data !== undefined) return true;
  if (isError) return false;
  return undefined;
}
