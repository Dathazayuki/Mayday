import type { Uas7ScoreData, Uas7WeekData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

const UAS7_KEY = ['uas7-scores'] as const;

const isValidPatientId = (patientId: number) => Number.isInteger(patientId) && patientId > 0;

/** Lịch sử điểm UAS7 của bệnh nhân, mới nhất trước. */
export function usePatientUas7History(patientId: number) {
  return useQuery({
    queryKey: [...UAS7_KEY, 'patient', patientId],
    queryFn: () => apiClient.get<Uas7ScoreData[]>(`/uas7-scores/patient/${patientId}`),
    enabled: isValidPatientId(patientId),
  });
}

/** Tổng điểm 7 ngày gần nhất (server mặc định kỳ khi không gửi start_date). */
export function useUas7Week(patientId: number) {
  return useQuery({
    queryKey: [...UAS7_KEY, 'week', patientId],
    queryFn: () => apiClient.get<Uas7WeekData>(`/uas7-scores/week/${patientId}`),
    enabled: isValidPatientId(patientId),
  });
}
