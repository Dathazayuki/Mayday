/** Một dòng thuốc theo Sheet rx01 (MT-14: cấu trúc CSDL khác, chờ chốt). */
export interface PrescriptionItemInput {
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instruction?: string;
}

/** POST /api/v1/prescriptions. */
export interface CreatePrescriptionRequest {
  medical_record_id: string;
  note?: string;
  items: PrescriptionItemInput[];
}

export interface PrescriptionItemData {
  prescription_item_id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instruction: string | null;
}

/** data của POST /prescriptions (1001) — mọi trường là chuỗi. */
export interface PrescriptionData {
  prescription_id: string;
  medical_record_id: string;
  created_by: string;
  note: string | null;
  items: PrescriptionItemData[];
  created_at: string;
}
