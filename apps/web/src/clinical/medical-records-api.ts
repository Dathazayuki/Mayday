import type {
  AcceptMedicalRecordData,
  AnswerData,
  AnswersCountData,
  AnswerInput,
  CloseMedicalRecordRequest,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordListQuery,
  MedicalRecordStatusData,
  MedicalRecordSummary,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

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

export function useMedicalRecordAnswers(id: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'answers', id],
    queryFn: () => apiClient.get<AnswerData[]>(`/medical_records/${id}/answers`),
  });
}

/** Mọi thay đổi trạng thái hoặc câu trả lời làm mới danh sách, chi tiết, tóm tắt, lịch sử và câu trả lời. */
export const useAcceptMedicalRecord = () =>
  useInvalidatingMutation([RECORDS_KEY], (id: number) =>
    apiClient.post<AcceptMedicalRecordData>(`/medical_records/${id}/accept`),
  );

export const useSaveAnswers = () =>
  useInvalidatingMutation(
    [RECORDS_KEY],
    ({ id, answers }: { id: number; answers: AnswerInput[] }) =>
      apiClient.put<AnswersCountData>(`/medical_records/${id}/answers`, { answers }),
  );

/** Chốt bệnh án (PUT /:id) với dặn dò cho bệnh nhân. */
export const useCloseMedicalRecord = () =>
  useInvalidatingMutation(
    [RECORDS_KEY],
    ({ id, ...body }: { id: number } & CloseMedicalRecordRequest) =>
      apiClient.put<MedicalRecordData>(`/medical_records/${id}`, body),
  );

export const useCancelMedicalRecord = () =>
  useInvalidatingMutation([RECORDS_KEY], (id: number) =>
    apiClient.patch<MedicalRecordStatusData>(`/medical_records/${id}/status`, {
      status: 'cancelled',
    }),
  );
