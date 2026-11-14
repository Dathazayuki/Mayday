import type { ProfileData, UpdateProfileRequest } from '@drmayday/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const PROFILE_QUERY_KEY = ['profile'];

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => apiClient.get<ProfileData>('/profile'),
  });
}

/** PUT /profile trả cùng dạng GET: ghi thẳng vào cache để hiện dữ liệu mới. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateProfileRequest) => apiClient.put<ProfileData>('/profile', changes),
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_QUERY_KEY, profile),
  });
}
