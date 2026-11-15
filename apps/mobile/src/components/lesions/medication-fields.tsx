import {
  MEDICATION_NAME_MAX_LENGTH,
  MEDICATION_UNITS,
  MEDICATION_UNIT_LABELS,
  type MedicationUnit,
} from '@drmayday/shared';
import { FormField } from '@/components/form-field';
import { OptionPicker } from '@/components/option-picker';

const UNIT_OPTIONS = MEDICATION_UNITS.map((unit) => ({
  value: unit,
  label: MEDICATION_UNIT_LABELS[unit],
}));

interface MedicationFieldsProps {
  name: string;
  takenAgo: string;
  unit: MedicationUnit | null;
  takenAgoError?: string | null;
  onNameChange: (value: string) => void;
  onTakenAgoChange: (value: string) => void;
  onUnitChange: (value: MedicationUnit | null) => void;
}

/** Thuốc đã dùng: tên, "dùng cách đây" (số và đơn vị). */
export function MedicationFields({
  name,
  takenAgo,
  unit,
  takenAgoError,
  onNameChange,
  onTakenAgoChange,
  onUnitChange,
}: MedicationFieldsProps) {
  return (
    <>
      <FormField
        label="Tên thuốc đã dùng"
        value={name}
        onChangeText={onNameChange}
        maxLength={MEDICATION_NAME_MAX_LENGTH}
      />
      <FormField
        label="Dùng cách đây"
        value={takenAgo}
        onChangeText={onTakenAgoChange}
        error={takenAgoError}
        keyboardType="number-pad"
        placeholder="VD: 2"
        maxLength={9}
      />
      <OptionPicker
        label="Đơn vị thời gian"
        options={UNIT_OPTIONS}
        value={unit}
        onChange={onUnitChange}
      />
    </>
  );
}
