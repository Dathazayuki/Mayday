import type { CreateVisitRequest, UpdateVisitRequest, VisitData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';
import { AFTER_WRITE, RECORDS_KEY } from './medical-records-api';

/**
 * Phiên khám của một bệnh án (spec B, mục 5.4). Khoá query nằm dưới tiền tố bệnh án nên tiếp nhận, hoàn
 * tất (dặn dò vào phiên mới nhất) cũng làm mới danh sách phiên; thêm, sửa phiên làm mới chi tiết, cột,
 * Tổng quan (số phiên, ngày khám gần nhất, ngày hẹn, phiên hôm nay).
 */
export function useVisits(recordId: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'visits', recordId],
    queryFn: () => apiClient.get<VisitData[]>(`/medical_records/${recordId}/visits`),
  });
}

/** POST /medical_records/:id/visits: `visit_date` vắng = hôm nay giờ Việt Nam (D-B23). */
export const useAddVisit = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ recordId, body }: { recordId: number; body: CreateVisitRequest }) =>
      apiClient.post<VisitData>(`/medical_records/${recordId}/visits`, body),
  );

/** PATCH /visits/:id: chỉ các trường đã đổi (spec B, mục 8.7). */
export const useUpdateVisit = () =>
  useInvalidatingMutation(AFTER_WRITE, ({ id, body }: { id: number; body: UpdateVisitRequest }) =>
    apiClient.patch<VisitData>(`/visits/${id}`, body),
  );
