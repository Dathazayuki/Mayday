import type { LabResultRequestData } from '@drmayday/shared';
import { apiClient } from './api';

/** Chỉ định xét nghiệm của một bệnh án; trường kết quả là null khi chưa có (MT-78). */
export function fetchLabResults(recordId: string): Promise<LabResultRequestData[]> {
  return apiClient.get<LabResultRequestData[]>(`/lab-results/${encodeURIComponent(recordId)}`);
}
