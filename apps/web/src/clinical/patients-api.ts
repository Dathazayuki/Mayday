import type {
  CreatePatientRequest,
  CreatePatientResponseData,
  PatientSearchItem,
  PatientSearchQuery,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

const PATIENTS_KEY = ['patients'] as const;

/** Tìm bệnh nhân phía server (total nằm ngoài data); giữ trang cũ trên màn hình trong lúc tải trang mới. */
export function usePatientSearch(
  query: Required<Pick<PatientSearchQuery, 'page' | 'limit'>> & PatientSearchQuery,
) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'search', query],
    queryFn: () => apiClient.getPage<PatientSearchItem>('/doctor/patients/search', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export const useCreatePatient = () =>
  useInvalidatingMutation([PATIENTS_KEY], (body: CreatePatientRequest) =>
    apiClient.post<CreatePatientResponseData>('/doctor/patients/create', body),
  );
