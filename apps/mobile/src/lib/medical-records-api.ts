import type {
  CreateMedicalRecordRequest,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordStatusData,
  SelfReportFields,
  UpdateMedicalRecordRequest,
  UpdateMedicalRecordStatusRequest,
  VisitData,
} from '@drmayday/shared';
import { apiClient } from './api';

const BASE = '/medical_records';

/** Lịch sử bệnh án (medrec13): bệnh nhân chỉ xem được của mình. */
export function fetchHistory(patientId: number): Promise<MedicalRecordHistoryItem[]> {
  return apiClient.get<MedicalRecordHistoryItem[]>(`${BASE}/patients/${patientId}/history`);
}

export function fetchMedicalRecord(id: string): Promise<MedicalRecordData> {
  return apiClient.get<MedicalRecordData>(`${BASE}/${encodeURIComponent(id)}`);
}

/** Phiên khám của bệnh án (spec B, mục 5.4); bệnh nhân nhận dạng rút gọn `details: null` (D-B21). */
export function fetchVisits(recordId: string): Promise<VisitData[]> {
  return apiClient.get<VisitData[]>(`${BASE}/${encodeURIComponent(recordId)}/visits`);
}

/** Bệnh nhân tự khai hồ sơ của mình (D-B30): chỉ `record_type` và `self_report`. */
export function createMedicalRecord(
  request: CreateMedicalRecordRequest,
): Promise<MedicalRecordData> {
  return apiClient.post<MedicalRecordData>(BASE, request);
}

/** Sửa phần tự khai khi hồ sơ chưa tiếp nhận (D-B30): chỉ các trường đã đổi. */
export function updateSelfReport(
  id: string,
  selfReport: Partial<SelfReportFields>,
): Promise<MedicalRecordData> {
  const body: UpdateMedicalRecordRequest = { self_report: selfReport };
  return apiClient.patch<MedicalRecordData>(`${BASE}/${encodeURIComponent(id)}`, body);
}

/** Tự huỷ hồ sơ chưa tiếp nhận (D-B32, MT-131). */
export function cancelMedicalRecord(id: string): Promise<MedicalRecordStatusData> {
  const body: UpdateMedicalRecordStatusRequest = { status: 'cancelled' };
  return apiClient.patch<MedicalRecordStatusData>(`${BASE}/${encodeURIComponent(id)}/status`, body);
}
