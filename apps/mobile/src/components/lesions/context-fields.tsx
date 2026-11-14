import { FormField } from '@/components/form-field';
import type { ContextFormErrors, ContextFormValues } from '@drmayday/shared';
import { ContextTagsInput } from './context-tags-input';
import { DatetimeFields } from './datetime-fields';
import { MedicationFields } from './medication-fields';

interface ContextFieldsProps {
  values: ContextFormValues;
  errors: ContextFormErrors;
  occurredAtLabel: string;
  onChange: (values: ContextFormValues) => void;
}

/** Bối cảnh và thuốc, dùng chung cho đợt và vị trí tổn thương. */
export function ContextFields({ values, errors, occurredAtLabel, onChange }: ContextFieldsProps) {
  const set = <K extends keyof ContextFormValues>(key: K, value: ContextFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <>
      <DatetimeFields
        label={occurredAtLabel}
        value={values.occurred_at}
        onChange={(value) => set('occurred_at', value)}
        error={errors.occurred_at}
      />
      <ContextTagsInput tags={values.tags} onChange={(tags) => set('tags', tags)} />
      <FormField
        label="Bối cảnh khác"
        value={values.context_other}
        onChangeText={(value) => set('context_other', value)}
        multiline
      />
      <MedicationFields
        name={values.medication_name}
        takenAgo={values.medication_taken_ago}
        unit={values.medication_unit}
        takenAgoError={errors.medication_taken_ago}
        onNameChange={(value) => set('medication_name', value)}
        onTakenAgoChange={(value) => set('medication_taken_ago', value)}
        onUnitChange={(value) => set('medication_unit', value)}
      />
    </>
  );
}
