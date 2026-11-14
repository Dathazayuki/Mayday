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
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

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

export const useCreateBranch = () =>
  useInvalidatingMutation([FACILITIES_KEY], (body: CreateBranchRequest) =>
    apiClient.post<BranchData>('/branches', body),
  );
export const useUpdateBranch = () =>
  useInvalidatingMutation(
    [FACILITIES_KEY],
    ({ id, changes }: { id: string; changes: UpdateBranchRequest }) =>
      apiClient.put<BranchData>(`/branches/${id}`, changes),
  );
export const useDeleteBranch = () =>
  useInvalidatingMutation([FACILITIES_KEY], (id: string) =>
    apiClient.delete<object>(`/branches/${id}`),
  );

export const useCreateDepartment = () =>
  useInvalidatingMutation([FACILITIES_KEY], (body: CreateDepartmentRequest) =>
    apiClient.post<DepartmentCreatedData>('/departments', body),
  );
export const useUpdateDepartment = () =>
  useInvalidatingMutation(
    [FACILITIES_KEY],
    ({ id, changes }: { id: string; changes: UpdateDepartmentRequest }) =>
      apiClient.put<DepartmentData>(`/departments/${id}`, changes),
  );
export const useDeleteDepartment = () =>
  useInvalidatingMutation([FACILITIES_KEY], (id: string) =>
    apiClient.delete<object>(`/departments/${id}`),
  );

export const useCreateRoom = () =>
  useInvalidatingMutation([FACILITIES_KEY], (body: CreateRoomRequest) =>
    apiClient.post<RoomCreatedData>('/rooms', body),
  );
export const useUpdateRoom = () =>
  useInvalidatingMutation(
    [FACILITIES_KEY],
    ({ id, changes }: { id: string; changes: UpdateRoomRequest }) =>
      apiClient.put<RoomData>(`/rooms/${id}`, changes),
  );
export const useDeleteRoom = () =>
  useInvalidatingMutation([FACILITIES_KEY], (id: string) =>
    apiClient.delete<object>(`/rooms/${id}`),
  );
