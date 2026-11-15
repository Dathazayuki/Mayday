import { DURATION_UNITS, type DurationUnit } from '@drmayday/shared';
import { InputNumber, Select, Space } from 'antd';
import type { DurationValue } from '../../../clinical/clinical-form';

const UNIT_OPTIONS = DURATION_UNITS.map((unit) => ({ value: unit.value, label: unit.label }));

/**
 * Ô `duration` (spec B, mục 8.7; MT-124): số + đơn vị phút/giờ/ngày; form đổi sang số giây khi gửi
 * (clinical-form.ts). `id` của Form.Item gắn vào ô số để nhãn trỏ đúng ô.
 */
export function DurationInput({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value?: DurationValue;
  onChange?: (value: DurationValue) => void;
}) {
  const current: DurationValue = value ?? { amount: null, unit: 'minute' };
  return (
    <Space.Compact block>
      <InputNumber
        id={id}
        min={0}
        decimalSeparator=","
        value={current.amount}
        onChange={(amount) => onChange?.({ ...current, amount })}
        style={{ width: '100%' }}
      />
      <Select<DurationUnit>
        aria-label={`Đơn vị: ${label}`}
        value={current.unit}
        onChange={(unit) => onChange?.({ ...current, unit })}
        options={UNIT_OPTIONS}
        style={{ width: 96 }}
      />
    </Space.Compact>
  );
}
