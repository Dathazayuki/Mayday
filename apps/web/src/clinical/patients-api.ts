import type {
  CreatePatientRequest,
  PatientData,
  PatientSearchItem,
  PatientSearchQuery,
  UpdatePatientRequest,
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

/** Chi tiết bệnh nhân (GET /doctor/patients/:id). */
export function usePatient(patientId: number) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'detail', patientId],
    queryFn: () => apiClient.get<PatientData>(`/doctor/patients/${patientId}`),
  });
}

export const useCreatePatient = () =>
  useInvalidatingMutation([PATIENTS_KEY], (body: CreatePatientRequest) =>
    apiClient.post<PatientData>('/doctor/patients/create', body),
  );

/** PUT /doctor/patients/:id; làm mới danh sách và chi tiết. */
export const useUpdatePatient = () =>
  useInvalidatingMutation(
    [PATIENTS_KEY],
    ({ id, changes }: { id: number; changes: UpdatePatientRequest }) =>
      apiClient.put<PatientData>(`/doctor/patients/${id}`, changes),
  );
