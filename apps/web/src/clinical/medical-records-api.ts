import type {
  AcceptMedicalRecordData,
  AcceptMedicalRecordRequest,
  CloseMedicalRecordRequest,
  CreateMedicalRecordRequest,
  MedicalRecordCountsQuery,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordListQuery,
  MedicalRecordStatus,
  MedicalRecordStatusCounts,
  MedicalRecordStatusData,
  UpdateMedicalRecordStatusRequest,
} from '@drmayday/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';
import { DASHBOARD_KEY } from './dashboard-api';

/** Tiền tố của mọi query bệnh án (danh sách, cột, số đếm, chi tiết, lịch sử). */
const RECORDS_KEY = ['medical-records'] as const;

/** Sau mọi thao tác ghi: làm mới mọi query bệnh án và Tổng quan (spec B, mục 8.6). */
const AFTER_WRITE = [RECORDS_KEY, DASHBOARD_KEY] as const;

/** Số thẻ mỗi lần tải của một cột (spec B, mục 8.5). */
export const BOARD_PAGE_SIZE = 20;

/** Danh sách mọi bệnh án (lọc theo trạng thái/bệnh nhân/loại/bác sĩ phụ trách), phân trang phía server. */
export function useMedicalRecords(
  query: Required<Pick<MedicalRecordListQuery, 'page' | 'limit'>> & MedicalRecordListQuery,
) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'list', query],
    queryFn: () => apiClient.getPage<MedicalRecordListItem>('/medical_records/all', { ...query }),
    placeholderData: keepPreviousData,
  });
}

/** Số hồ sơ theo trạng thái (tab của bảng, đầu cột), cùng bộ lọc với danh sách (MT-120). */
export function useStatusCounts(filter: MedicalRecordCountsQuery) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'status-counts', filter],
    queryFn: () =>
      apiClient.get<MedicalRecordStatusCounts>('/medical_records/status-counts', { ...filter }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Thẻ của một cột (spec B, mục 8.5): mã hồ sơ giảm dần, BOARD_PAGE_SIZE thẻ một lần, `fetchNextPage` cho
 * nút "Xem thêm". `enabled` false: cột thu gọn chưa tải thẻ.
 */
export function useColumnRecords(
  status: MedicalRecordStatus,
  filter: MedicalRecordCountsQuery,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: [...RECORDS_KEY, 'column', status, filter],
    queryFn: ({ pageParam }) =>
      apiClient.getPage<MedicalRecordListItem>('/medical_records/all', {
        ...filter,
        status,
        page: pageParam,
        limit: BOARD_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.length * BOARD_PAGE_SIZE < last.total ? pages.length + 1 : undefined,
    enabled,
  });
}

/** Chi tiết một bệnh án; chưa có mã (hộp chưa mở) thì không gọi API. */
export function useMedicalRecord(id: number | undefined) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'detail', id],
    queryFn: () => apiClient.get<MedicalRecordData>(`/medical_records/${id}`),
    enabled: id !== undefined,
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

/** medrec03: nhân viên tạo bệnh án cho bệnh nhân (luôn `pending`, D-B4). */
export const useCreateMedicalRecord = () =>
  useInvalidatingMutation(AFTER_WRITE, (body: CreateMedicalRecordRequest) =>
    apiClient.post<MedicalRecordData>('/medical_records', body),
  );

/** medrec07: tiếp nhận, mở phiên đầu; `room_id` vắng = chưa phân phòng (MT-115). */
export const useAcceptMedicalRecord = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ id, body }: { id: number; body: AcceptMedicalRecordRequest }) =>
      apiClient.post<AcceptMedicalRecordData>(`/medical_records/${id}/accept`, body),
  );

/** medrec11: hoàn tất hoặc huỷ hồ sơ đang khám; dặn dò ghi vào phiên mới nhất (D-B8). */
export const useCloseMedicalRecord = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ id, body }: { id: number; body: CloseMedicalRecordRequest }) =>
      apiClient.put<MedicalRecordData>(`/medical_records/${id}`, body),
  );

/** Huỷ hồ sơ chưa tiếp nhận (PATCH /medical_records/:id/status, chỉ `cancelled`). */
export const useCancelMedicalRecord = () =>
  useInvalidatingMutation(AFTER_WRITE, (id: number) =>
    apiClient.patch<MedicalRecordStatusData>(`/medical_records/${id}/status`, {
      status: 'cancelled',
    } satisfies UpdateMedicalRecordStatusRequest),
  );
