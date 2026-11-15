import type {
  CreateLabRequestRequest,
  LabRequestData,
  LabResultRequestData,
} from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

const LABS_KEY = ['lab-results'] as const;

/** Các phiếu xét nghiệm của bệnh án cùng kết quả (trường kết quả null khi chưa có). */
export function useLabResults(recordId: number) {
  return useQuery({
    queryKey: [...LABS_KEY, recordId],
    queryFn: () => apiClient.get<LabResultRequestData[]>(`/lab-results/${recordId}`),
  });
}

export function useCreateLabRequest() {
  return useInvalidatingMutation([LABS_KEY], (body: CreateLabRequestRequest) =>
    apiClient.post<LabRequestData>('/lab-requests', body),
  );
}
