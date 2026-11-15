import type {
  AnswerData,
  AnswerInput,
  AnswersCountData,
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
  return apiClient.get<MedicalRecordData>(`${BASE}/${encodeURIComponent(id)}`);
}

export function fetchAnswers(id: string): Promise<AnswerData[]> {
  return apiClient.get<AnswerData[]>(`${BASE}/${encodeURIComponent(id)}/answers`);
}

export function cancelMedicalRecord(id: string): Promise<MedicalRecordStatusData> {
  return apiClient.patch<MedicalRecordStatusData>(`${BASE}/${encodeURIComponent(id)}/status`, {
    status: 'cancelled',
  });
}

/** Ghi câu trả lời tại chỗ (giữ answers.id); phần tử chỉ có question_id tạo câu trả lời rỗng (MT-93). */
export function saveAnswers(id: string, answers: AnswerInput[]): Promise<AnswersCountData> {
  return apiClient.put<AnswersCountData>(`${BASE}/${encodeURIComponent(id)}/answers`, { answers });
}
