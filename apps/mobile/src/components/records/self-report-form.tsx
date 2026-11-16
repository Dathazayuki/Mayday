import {
  selfReportFieldsFor,
  type ClinicalField,
  type RecordType,
  type SelfReportFormErrors,
  type SelfReportFormValues,
  type SelfReportKey,
} from '@drmayday/shared';
import { FormField } from '@/components/form-field';
import { OptionPicker } from '@/components/option-picker';

interface SelfReportFormProps {
  type: RecordType;
  values: SelfReportFormValues;
  errors: SelfReportFormErrors;
  onChange: (values: SelfReportFormValues) => void;
}

/**
 * Ô tự khai dựng từ bộ mô tả của shared (D-B13; spec B, mục 9.1): chữ → ô nhiều dòng, số tuần → bàn phím
 * số, tập giá trị → nút chọn (bấm lại để bỏ chọn). Biểu hiện bệnh chỉ ở hồ sơ mạn (selfReportFieldsFor).
 * Mọi ô không bắt buộc; lỗi do `validateSelfReport` của shared tính, hiện dưới ô.
 */
export function SelfReportForm({ type, values, errors, onChange }: SelfReportFormProps) {
  const set = (key: SelfReportKey, value: string) => onChange({ ...values, [key]: value });

  function renderField(field: ClinicalField<SelfReportKey>) {
    if (field.type === 'enum') {
      return (
        <OptionPicker
          key={field.key}
          label={field.label}
          options={field.options}
          value={values[field.key] || null}
          onChange={(value) => set(field.key, value ?? '')}
        />
      );
    }
    const decimal = field.type === 'decimal';
    return (
      <FormField
        key={field.key}
        label={field.label}
        value={values[field.key]}
        onChangeText={(value) => set(field.key, value)}
        error={errors[field.key]}
        keyboardType={decimal ? 'decimal-pad' : 'default'}
        multiline={!decimal}
        maxLength={field.type === 'text' ? field.maxLength : undefined}
      />
    );
  }

  return <>{selfReportFieldsFor(type).map(renderField)}</>;
}
