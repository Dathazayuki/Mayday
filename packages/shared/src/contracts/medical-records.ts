export const MEDICAL_RECORD_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type MedicalRecordStatus = (typeof MEDICAL_RECORD_STATUSES)[number];

/** POST /api/v1/medical_records — bệnh nhân bỏ qua patient_id. */
export interface CreateMedicalRecordRequest {
  patient_id?: number;
  template_id: string;
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

/** PATCH /api/v1/medical_records/:id/status — Sheet chỉ cho cancelled; data kiểu string theo tab. */
export interface UpdateMedicalRecordStatusRequest {
  status: 'cancelled';
}

export interface MedicalRecordStatusData {
  id: string;
  status: MedicalRecordStatus;
}
