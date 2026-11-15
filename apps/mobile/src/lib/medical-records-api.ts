import type { MedicalRecordData, MedicalRecordHistoryItem, VisitData } from '@drmayday/shared';
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
