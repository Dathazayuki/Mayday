import type { QuestionType } from './templates.js';

export const MEDICAL_RECORD_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type MedicalRecordStatus = (typeof MEDICAL_RECORD_STATUSES)[number];

/** GET /api/v1/medical_records/classify-questions phần tử. */
export interface ClassifyQuestion {
  question_id: string;
  question_text: string;
  type_question: QuestionType;
  options: { id: number; option_text: string; option_value: string }[];
}

export interface ClassifyRequest {
  answers: { question_id: string; option_value: string }[];
}

export interface ClassifyResponseData {
  template_id: string;
  template_name: string;
}

/** Một câu trả lời gửi lên (POST /medical_records, PUT /:id/answers). */
export interface AnswerInput {
  question_id: string;
  question_option_id?: number | null;
  answer_text?: string | null;
  /** JSON tuỳ kiểu câu hỏi: option_value (radio), mảng option_value (checkbox), số (number). */
  answer_value?: unknown;
}

/** POST /api/v1/medical_records — bệnh nhân bỏ qua patient_id. */
export interface CreateMedicalRecordRequest {
  patient_id?: number;
  template_id: string;
  answers?: AnswerInput[];
}

export interface MedicalRecordCreatedData {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  created_by: number | null;
  template_id: string;
  status: MedicalRecordStatus;
  instructions: string | null;
  created_at: string;
}

export interface MedicalRecordListQuery {
  status?: MedicalRecordStatus;
  patient_id?: number;
  page?: number;
  limit?: number;
}

/** GET /api/v1/medical_records/all phần tử (total ngoài data). */
export interface MedicalRecordListItem {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  template_id: string | null;
  status: MedicalRecordStatus;
  created_at: string;
}

/** GET/PUT /api/v1/medical_records/:id. */
export interface MedicalRecordData {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  created_by: number | null;
  template_id: string | null;
  status: MedicalRecordStatus;
  instructions: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalRecordSummary {
  medical_record_id: number;
  status: MedicalRecordStatus;
  patient_name: string;
  created_at: string;
}

export interface MedicalRecordHistoryItem {
  medical_record_id: number;
  status: MedicalRecordStatus;
  instructions: string | null;
  created_at: string;
}

export interface AcceptMedicalRecordData {
  medical_record_id: number;
  assigned_doctor_id: number;
  status: MedicalRecordStatus;
}

/** PUT /api/v1/medical_records/:id — chốt bệnh án. */
export interface CloseMedicalRecordRequest {
  status: 'completed' | 'cancelled';
  instructions?: string | null;
}

/** GET /api/v1/medical_records/:id/answers phần tử. */
export interface AnswerData {
  id: number;
  medical_record_id: number;
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown;
  answered_by: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertAnswersRequest {
  answers: AnswerInput[];
}

/** data của PUT/POST /:id/answers (POST trả trong data theo MT-72). */
export interface AnswersCountData {
  count: number;
}

/** POST /api/v1/medical_records/:id/answers — Sheet dùng option_id kiểu string. */
export interface AddAnswersRequest {
  answers: { question_id: string; answer_text?: string; option_id?: string }[];
}

/** PATCH /api/v1/medical_records/:id/status — Sheet chỉ cho cancelled; data kiểu string theo tab. */
export interface UpdateMedicalRecordStatusRequest {
  status: 'cancelled';
}

export interface MedicalRecordStatusData {
  id: string;
  status: MedicalRecordStatus;
}
