import type {
  BranchData,
  BranchListItem,
  CreateBranchRequest,
  CreateRoomRequest,
  RoomCreatedData,
  RoomData,
  RoomListItem,
  UpdateBranchRequest,
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

/** Phòng khám thuộc thẳng chi nhánh (spec A, quyết định 11); `branchId` vắng = mọi chi nhánh. */
export function useRooms(branchId?: number) {
  return useQuery({
    queryKey: [...FACILITIES_KEY, 'rooms', { branchId }],
    queryFn: () => apiClient.get<RoomListItem[]>('/rooms', { branch_id: branchId }),
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
