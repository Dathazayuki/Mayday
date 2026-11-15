import { isPatientProfile } from '@drmayday/shared';
import { useProfile } from './profile-api';

/**
 * Người đăng nhập có phải bệnh nhân không: danh sách vai trò chỉ dành cho admin nên nhận ra qua
 * GET /profile (hồ sơ bệnh nhân có các trường bệnh nhân). Dùng chung cache với trang hồ sơ.
 * Chưa có hồ sơ (đang tải hoặc lỗi) → undefined.
 */
export function useIsPatient(): boolean | undefined {
  const { data } = useProfile();
  return data === undefined ? undefined : isPatientProfile(data);
}
