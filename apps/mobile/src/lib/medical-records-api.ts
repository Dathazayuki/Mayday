import type {
  AnswerData,
  ClassifyQuestion,
  ClassifyRequest,
  ClassifyResponseData,
  CreateMedicalRecordRequest,
  MedicalRecordCreatedData,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordStatusData,
  TemplateDetailData,
} from '@drmayday/shared';
import { apiClient } from './api';

const BASE = '/medical_records';

export function fetchClassifyQuestions(): Promise<ClassifyQuestion[]> {
  return apiClient.get<ClassifyQuestion[]>(`${BASE}/classify-questions`);
}

export function classify(request: ClassifyRequest): Promise<ClassifyResponseData> {
  return apiClient.post<ClassifyResponseData>(`${BASE}/classify`, request);
}

export function fetchTemplate(templateId: string): Promise<TemplateDetailData> {
  return apiClient.get<TemplateDetailData>(`/templates/${encodeURIComponent(templateId)}`);
}

/** Bệnh nhân bỏ qua patient_id: máy chủ dùng chính người gọi. */
export function createMedicalRecord(
  request: CreateMedicalRecordRequest,
): Promise<MedicalRecordCreatedData> {
  return apiClient.post<MedicalRecordCreatedData>(BASE, request);
}

export function fetchHistory(patientId: number): Promise<MedicalRecordHistoryItem[]> {
  return apiClient.get<MedicalRecordHistoryItem[]>(`${BASE}/patients/${patientId}/history`);
}

export function fetchMedicalRecord(id: string): Promise<MedicalRecordData> {
  return apiClient.get<MedicalRecordData>(`${BASE}/${id}`);
}

export function fetchAnswers(id: string): Promise<AnswerData[]> {
  return apiClient.get<AnswerData[]>(`${BASE}/${id}/answers`);
}

export function cancelMedicalRecord(id: string): Promise<MedicalRecordStatusData> {
  return apiClient.patch<MedicalRecordStatusData>(`${BASE}/${id}/status`, { status: 'cancelled' });
}
