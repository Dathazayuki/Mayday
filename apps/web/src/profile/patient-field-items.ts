import {
  CAREER_OPTIONS,
  GENDER_OPTIONS,
  type Gender,
  type PatientEditableField,
  type PatientProfileFields,
} from '@drmayday/shared';
import { EMPTY_VALUE, formatDate, formatDateTime } from '../lib/format-date';
import { PATIENT_FIELD_LABELS } from './profile-form';

/** Một dòng của bảng thông tin (antd Descriptions): nhãn và giá trị đã định dạng. */
export interface FieldItem {
  label: string;
  value: string | number;
}

export function genderLabel(gender: Gender | null): string {
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? EMPTY_VALUE;
}

function textItem(field: PatientEditableField, value: string | null): FieldItem {
  return { label: PATIENT_FIELD_LABELS[field], value: value ?? EMPTY_VALUE };
}

/**
 * Trường hồ sơ bệnh nhân theo thứ tự hiển thị, dùng chung cho Drawer người dùng của admin và trang chi
 * tiết bệnh nhân. Ngày dạng dd/MM/yyyy (F.12); trống → "—"; chưa có lần khám → "Chưa có".
 */
export function patientFieldItems(profile: PatientProfileFields): FieldItem[] {
  return [
    {
      label: PATIENT_FIELD_LABELS.year_of_birth,
      value: profile.year_of_birth ?? EMPTY_VALUE,
    },
    {
      label: PATIENT_FIELD_LABELS.career,
      value: CAREER_OPTIONS.find((option) => option.value === profile.career)?.label ?? EMPTY_VALUE,
    },
    textItem('ethnic', profile.ethnic),
    textItem('hamlet_address', profile.hamlet_address),
    textItem('commune_address', profile.commune_address),
    textItem('city_address', profile.city_address),
    textItem('health_insurance_number', profile.health_insurance_number),
    textItem(
      'health_insurance_validate',
      profile.health_insurance_validate && formatDate(profile.health_insurance_validate),
    ),
    textItem('next_of_kin_name', profile.next_of_kin_name),
    textItem('next_of_kin_phone', profile.next_of_kin_phone),
    {
      label: 'Lần khám đầu tiên',
      value: profile.first_visit ? formatDateTime(profile.first_visit) : 'Chưa có',
    },
  ];
}
