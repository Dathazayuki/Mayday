import type { CreatePrescriptionRequest, PrescriptionData } from '@drmayday/shared';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const issuedKey = (recordId: number) => ['prescriptions', 'issued', recordId] as const;

/**
 * Đơn vừa kê cho bệnh án, lấy từ cache (chưa có API xem đơn đã kê, MT-77): query dùng skipToken
 * nên chỉ đọc dữ liệu useCreatePrescription đã ghi vào cache.
 */
export function useIssuedPrescription(recordId: number) {
  return useQuery<PrescriptionData | null>({
    queryKey: issuedKey(recordId),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Kê đơn; thành công thì giữ đơn trả về trong cache để còn hiển thị trong phiên. */
export function useCreatePrescription(recordId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePrescriptionRequest) =>
      apiClient.post<PrescriptionData>('/prescriptions', body),
    onSuccess: (data) => queryClient.setQueryData(issuedKey(recordId), data),
  });
}
