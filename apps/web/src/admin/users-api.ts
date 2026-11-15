import type {
  AdminUserDetailData,
  AdminUserListItem,
  AdminUserListQuery,
  AssignUserRequest,
  AssignUserResponseData,
  CreateStaffRequest,
  CreateStaffResponseData,
  CreateUserRequest,
  CreateUserResponseData,
  RoleData,
  UpdateUserRequest,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

const USERS_KEY = ['admin-users'] as const;

/** Vai trò của bệnh nhân (spec 3.3): nhóm "bệnh nhân" là các vai trò mang tên này, còn lại là nhân viên. */
export const PATIENT_ROLE_NAME = 'patient';

export const isPatientRole = (role: RoleData) => role.name === PATIENT_ROLE_NAME;

/** Danh sách phân trang phía server; giữ trang cũ trên màn hình trong lúc tải trang mới. */
export function useAdminUsers({
  page,
  limit,
  role_id,
}: Required<Pick<AdminUserListQuery, 'page' | 'limit'>> & Pick<AdminUserListQuery, 'role_id'>) {
  return useQuery({
    queryKey: [...USERS_KEY, 'list', { page, limit, role_id }],
    queryFn: () => apiClient.getPage<AdminUserListItem>('/admin/users', { page, limit, role_id }),
    placeholderData: keepPreviousData,
  });
}

/** Chi tiết một người dùng; chưa có id thì không gọi API. */
export function useAdminUser(userId: number | undefined) {
  return useQuery({
    queryKey: [...USERS_KEY, 'detail', userId],
    queryFn: () => apiClient.get<AdminUserDetailData>(`/admin/users/${userId}`),
    enabled: userId !== undefined,
  });
}

export const useCreateUser = () =>
  useInvalidatingMutation([USERS_KEY], (body: CreateUserRequest) =>
    apiClient.post<CreateUserResponseData>('/admin/users', body),
  );

/** Tạo tài khoản nhân viên kèm nơi công tác (giai đoạn 1, create-staff). */
export const useCreateStaff = () =>
  useInvalidatingMutation([USERS_KEY], (body: CreateStaffRequest) =>
    apiClient.post<CreateStaffResponseData>('/auth/admin/create-staff', body),
  );

export const useUpdateUser = () =>
  useInvalidatingMutation(
    [USERS_KEY],
    ({ id, changes }: { id: number; changes: UpdateUserRequest }) =>
      apiClient.put<AdminUserDetailData>(`/admin/users/${id}`, changes),
  );

export const useAssignUser = () =>
  useInvalidatingMutation(
    [USERS_KEY],
    ({ id, placement }: { id: number; placement: AssignUserRequest }) =>
      apiClient.put<AssignUserResponseData>(`/admin/users/${id}/assign`, placement),
  );

export const useDeleteUser = () =>
  useInvalidatingMutation([USERS_KEY], (id: number) =>
    apiClient.delete<object>(`/admin/users/${id}`),
  );
