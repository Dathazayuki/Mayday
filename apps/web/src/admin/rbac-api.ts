import type {
  CreatePermissionRequest,
  CreateRoleRequest,
  PermissionData,
  PermissionSummary,
  RoleData,
  RolePermissionData,
  SetRolePermissionsRequest,
  UpdatePermissionRequest,
} from '@drmayday/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

export const ROLES_KEY = ['roles'] as const;
const PERMISSIONS_KEY = ['permissions'] as const;
const ROLE_PERMISSIONS_KEY = ['role-permissions'] as const;

export const fetchRoles = () => apiClient.get<RoleData[]>('/roles');

export function useRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: fetchRoles });
}

export function usePermissions() {
  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: () => apiClient.get<PermissionData[]>('/permissions'),
  });
}

/** Quyền đã gán cho một vai trò; chưa chọn vai trò thì không gọi API. */
export function useRolePermissions(roleId: number | undefined) {
  return useQuery({
    queryKey: [...ROLE_PERMISSIONS_KEY, roleId],
    queryFn: () => apiClient.get<RolePermissionData[]>(`/role_permissions/role/${roleId}`),
    enabled: roleId !== undefined,
  });
}

/** Mọi thay đổi làm mới các nhóm query liên quan, kể cả khi thất bại giữa chừng. */
function useInvalidatingMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  keys: ReadonlyArray<readonly unknown[]>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useCreateRole = () =>
  useInvalidatingMutation(
    (body: CreateRoleRequest) => apiClient.post<RoleData>('/roles', body),
    [ROLES_KEY],
  );

export const useCreatePermission = () =>
  useInvalidatingMutation(
    (body: CreatePermissionRequest) => apiClient.post<PermissionSummary>('/permissions', body),
    [PERMISSIONS_KEY],
  );
export const useUpdatePermission = () =>
  useInvalidatingMutation(
    ({ id, changes }: { id: number; changes: UpdatePermissionRequest }) =>
      apiClient.put<PermissionData>(`/permissions/${id}`, changes),
    [PERMISSIONS_KEY, ROLE_PERMISSIONS_KEY],
  );
/** Xoá quyền kéo theo việc gỡ quyền đó khỏi mọi vai trò (CASCADE phía API). */
export const useDeletePermission = () =>
  useInvalidatingMutation(
    (id: number) => apiClient.delete<object>(`/permissions/${id}`),
    [PERMISSIONS_KEY, ROLE_PERMISSIONS_KEY],
  );

/**
 * Lưu phân quyền của một vai trò: một POST cho mọi quyền mới chọn (nếu có) và một DELETE cho mỗi
 * quyền bị bỏ chọn.
 */
export function useSaveRolePermissions() {
  return useInvalidatingMutation(
    ({ roleId, toAdd, toRemove }: { roleId: number; toAdd: number[]; toRemove: number[] }) => {
      const requests: Promise<unknown>[] = [];
      if (toAdd.length > 0) {
        const body: SetRolePermissionsRequest = { role_id: roleId, permissions: toAdd };
        requests.push(apiClient.post<object>('/role_permissions', body));
      }
      for (const permissionId of toRemove) {
        requests.push(apiClient.delete<object>(`/role_permissions/${roleId}/${permissionId}`));
      }
      return Promise.all(requests);
    },
    [ROLE_PERMISSIONS_KEY],
  );
}
