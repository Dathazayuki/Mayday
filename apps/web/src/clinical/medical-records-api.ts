import type {
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordListQuery,
  MedicalRecordSummary,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Tiền tố của mọi query bệnh án: thao tác ghi (B4) làm mới cả nhóm. */
const RECORDS_KEY = ['medical-records'] as const;

/** Danh sách mọi bệnh án (lọc theo trạng thái/bệnh nhân), phân trang phía server. */
export function useMedicalRecords(
  query: Required<Pick<MedicalRecordListQuery, 'page' | 'limit'>> & MedicalRecordListQuery,
) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'list', query],
    queryFn: () => apiClient.getPage<MedicalRecordListItem>('/medical_records/all', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useMedicalRecord(id: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'detail', id],
    queryFn: () => apiClient.get<MedicalRecordData>(`/medical_records/${id}`),
  });
}

export function useMedicalRecordSummary(id: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'summary', id],
    queryFn: () => apiClient.get<MedicalRecordSummary>(`/medical_records/${id}/summary`),
  });
}

/** Lịch sử bệnh án của một bệnh nhân; chưa biết bệnh nhân thì không gọi API. */
export function usePatientHistory(patientId: number | undefined) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'history', patientId],
    queryFn: () =>
      apiClient.get<MedicalRecordHistoryItem[]>(`/medical_records/patients/${patientId}/history`),
    enabled: patientId !== undefined,
  });
}
