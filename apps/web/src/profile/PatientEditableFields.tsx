import {
  CAREER_OPTIONS,
  isValidIsoDate,
  isValidVietnamPhone,
  isValidYearOfBirth,
  type PatientEditableField,
} from '@drmayday/shared';
import { Form, Input, InputNumber, Select } from 'antd';
import { PATIENT_FIELD_LABELS } from './profile-form';

/** Trường văn bản của bệnh nhân (theo thứ tự hiển thị), kèm quy tắc kiểm tra riêng nếu có. */
const PATIENT_TEXT_FIELDS: {
  name: Exclude<PatientEditableField, 'year_of_birth' | 'career'>;
  label: string;
  validate?: (value: string) => boolean;
  invalidMessage?: string;
}[] = [
  { name: 'ethnic', label: PATIENT_FIELD_LABELS.ethnic },
  { name: 'hamlet_address', label: PATIENT_FIELD_LABELS.hamlet_address },
  { name: 'commune_address', label: PATIENT_FIELD_LABELS.commune_address },
  { name: 'city_address', label: PATIENT_FIELD_LABELS.city_address },
  { name: 'work_place', label: PATIENT_FIELD_LABELS.work_place },
  { name: 'health_insurance_number', label: PATIENT_FIELD_LABELS.health_insurance_number },
  {
    name: 'health_insurance_validate',
    label: PATIENT_FIELD_LABELS.health_insurance_validate,
    validate: isValidIsoDate,
    invalidMessage: 'Ngày không đúng định dạng YYYY-MM-DD',
  },
  { name: 'next_of_kin_name', label: PATIENT_FIELD_LABELS.next_of_kin_name },
  {
    name: 'next_of_kin_phone',
    label: PATIENT_FIELD_LABELS.next_of_kin_phone,
    validate: isValidVietnamPhone,
    invalidMessage: 'Số điện thoại không đúng định dạng (VD: 0912345678)',
  },
];

/** Các trường hồ sơ bệnh nhân có thể sửa: dùng chung cho trang hồ sơ và form tạo bệnh nhân. */
export function PatientEditableFields() {
  return (
    <>
      <Form.Item
        label={PATIENT_FIELD_LABELS.year_of_birth}
        name="year_of_birth"
        rules={[
          {
            validator: (_, value: number | null | undefined) =>
              value == null || isValidYearOfBirth(value)
                ? Promise.resolve()
                : Promise.reject(new Error('Năm sinh không hợp lệ')),
          },
        ]}
      >
        <InputNumber precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label={PATIENT_FIELD_LABELS.career} name="career">
        <Select allowClear options={[...CAREER_OPTIONS]} />
      </Form.Item>
      {PATIENT_TEXT_FIELDS.map(({ name, label, validate, invalidMessage }) => (
        <Form.Item
          key={name}
          label={label}
          name={name}
          rules={
            validate
              ? [
                  {
                    validator: (_, value: string | null | undefined) =>
                      !value?.trim() || validate(value.trim())
                        ? Promise.resolve()
                        : Promise.reject(new Error(invalidMessage)),
                  },
                ]
              : undefined
          }
        >
          <Input />
        </Form.Item>
      ))}
    </>
  );
}
