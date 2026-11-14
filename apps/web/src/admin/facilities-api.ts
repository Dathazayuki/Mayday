import type {
  BranchData,
  BranchListItem,
  CreateBranchRequest,
  CreateDepartmentRequest,
  CreateRoomRequest,
  DepartmentCreatedData,
  DepartmentData,
  DepartmentListItem,
  RoomCreatedData,
  RoomData,
  RoomListItem,
  UpdateBranchRequest,
  UpdateDepartmentRequest,
  UpdateRoomRequest,
} from '@drmayday/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const FACILITIES_KEY = ['facilities'] as const;

/** ID trong danh sách là string, trong body gửi lên là số (spec 3.5): chuyển ở một chỗ duy nhất. */
export function toNumericId(id: string): number {
  return Number(id);
}

export function useBranches() {
  return useQuery({
    queryKey: [...FACILITIES_KEY, 'branches'],
    queryFn: () => apiClient.get<BranchListItem[]>('/branches'),
  });
}

export function useDepartments(branchId?: number) {
  return useQuery({
    queryKey: [...FACILITIES_KEY, 'departments', { branchId }],
    queryFn: () => apiClient.get<DepartmentListItem[]>('/departments', { branch_id: branchId }),
  });
}

export function useRooms(departmentId?: number) {
  return useQuery({
    queryKey: [...FACILITIES_KEY, 'rooms', { departmentId }],
    queryFn: () => apiClient.get<RoomListItem[]>('/rooms', { department_id: departmentId }),
  });
}

/** Mọi thay đổi làm mới toàn bộ nhóm facilities: khoa/phòng phụ thuộc chi nhánh/khoa. */
function useInvalidatingMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACILITIES_KEY }),
  });
}

export const useCreateBranch = () =>
  useInvalidatingMutation((body: CreateBranchRequest) =>
    apiClient.post<BranchData>('/branches', body),
  );
export const useUpdateBranch = () =>
  useInvalidatingMutation(({ id, changes }: { id: string; changes: UpdateBranchRequest }) =>
    apiClient.put<BranchData>(`/branches/${id}`, changes),
  );
export const useDeleteBranch = () =>
  useInvalidatingMutation((id: string) => apiClient.delete<object>(`/branches/${id}`));

export const useCreateDepartment = () =>
  useInvalidatingMutation((body: CreateDepartmentRequest) =>
    apiClient.post<DepartmentCreatedData>('/departments', body),
  );
export const useUpdateDepartment = () =>
  useInvalidatingMutation(({ id, changes }: { id: string; changes: UpdateDepartmentRequest }) =>
    apiClient.put<DepartmentData>(`/departments/${id}`, changes),
  );
export const useDeleteDepartment = () =>
  useInvalidatingMutation((id: string) => apiClient.delete<object>(`/departments/${id}`));

export const useCreateRoom = () =>
  useInvalidatingMutation((body: CreateRoomRequest) =>
    apiClient.post<RoomCreatedData>('/rooms', body),
  );
export const useUpdateRoom = () =>
  useInvalidatingMutation(({ id, changes }: { id: string; changes: UpdateRoomRequest }) =>
    apiClient.put<RoomData>(`/rooms/${id}`, changes),
  );
export const useDeleteRoom = () =>
  useInvalidatingMutation((id: string) => apiClient.delete<object>(`/rooms/${id}`));
