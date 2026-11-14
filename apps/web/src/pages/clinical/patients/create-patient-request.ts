import {
  PATIENT_EDITABLE_FIELDS,
  type CreatePatientRequest,
  type PatientProfileFields,
} from '@drmayday/shared';
import type { AccountValues } from '../../admin/users/AccountFields';

export type CreatePatientFormValues = AccountValues &
  Partial<Pick<PatientProfileFields, (typeof PATIENT_EDITABLE_FIELDS)[number]>>;

/** Body tạo bệnh nhân: bỏ các trường hồ sơ để trống, cắt khoảng trắng chuỗi. */
export function toCreatePatientRequest(values: CreatePatientFormValues): CreatePatientRequest {
  const request: CreatePatientRequest = {
    full_name: values.full_name.trim(),
    phone: values.phone!.trim(),
    password: values.password!,
    gender: values.gender,
  };
  for (const field of PATIENT_EDITABLE_FIELDS) {
    const raw = values[field];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value !== undefined && value !== null && value !== '') {
      Object.assign(request, { [field]: value });
    }
  }
  return request;
}
