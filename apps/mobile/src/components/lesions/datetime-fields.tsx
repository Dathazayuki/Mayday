import { LESION_DATETIME_FORMAT, formatLesionDateTime } from '@drmayday/shared';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';

interface DatetimeFieldsProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

/** Ô nhập ngày giờ dạng chữ (YYYY-MM-DD HH:mm:ss) kèm nút lấy thời điểm hiện tại. */
export function DatetimeFields({ label, value, onChange, error }: DatetimeFieldsProps) {
  return (
    <>
      <FormField
        label={label}
        value={value}
        onChangeText={onChange}
        error={error}
        placeholder={LESION_DATETIME_FORMAT}
        maxLength={LESION_DATETIME_FORMAT.length}
        keyboardType="numbers-and-punctuation"
      />
      <PrimaryButton
        title="Dùng thời điểm hiện tại"
        variant="secondary"
        onPress={() => onChange(formatLesionDateTime(new Date()))}
      />
    </>
  );
}
