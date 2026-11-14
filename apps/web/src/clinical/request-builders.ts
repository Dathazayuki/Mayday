import type { CreateLabRequestRequest, CreatePrescriptionRequest } from '@drmayday/shared';

type Optional = string | undefined;

export interface PrescriptionFormValues {
  note?: Optional;
  items: {
    medicine_name: string;
    dosage?: Optional;
    frequency?: Optional;
    duration?: Optional;
    instruction?: Optional;
  }[];
}

export interface LabRequestFormValues {
  note?: Optional;
  items: { test_name: string; description?: Optional }[];
}

/** Cắt khoảng trắng; chuỗi trống → undefined để JSON.stringify bỏ trường đó. */
const clean = (value: Optional): string | undefined => value?.trim() || undefined;

export function buildPrescriptionRequest(
  recordId: number,
  { note, items }: PrescriptionFormValues,
): CreatePrescriptionRequest {
  return {
    medical_record_id: String(recordId),
    note: clean(note),
    items: items.map((item) => ({
      medicine_name: item.medicine_name.trim(),
      dosage: clean(item.dosage),
      frequency: clean(item.frequency),
      duration: clean(item.duration),
      instruction: clean(item.instruction),
    })),
  };
}

export function buildLabRequest(
  recordId: number,
  { note, items }: LabRequestFormValues,
): CreateLabRequestRequest {
  return {
    medical_record_id: String(recordId),
    note: clean(note),
    items: items.map((item) => ({
      test_name: item.test_name.trim(),
      description: clean(item.description),
    })),
  };
}
