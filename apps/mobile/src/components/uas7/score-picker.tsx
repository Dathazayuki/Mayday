import { UAS7_LEVEL_LABELS, UAS7_SCORE_MAX, UAS7_SCORE_MIN } from '@drmayday/shared';
import { OptionPicker } from '@/components/option-picker';

const LEVELS = Array.from({ length: UAS7_SCORE_MAX - UAS7_SCORE_MIN + 1 }, (_, i) => {
  const level = UAS7_SCORE_MIN + i;
  return { value: String(level), label: `${level} - ${UAS7_LEVEL_LABELS[level]}` };
});

interface ScorePickerProps {
  label: string;
  /** Điểm "0".."3" hoặc null khi chưa chọn. */
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ScorePicker({ label, value, onChange }: ScorePickerProps) {
  return <OptionPicker label={label} options={LEVELS} value={value} onChange={onChange} />;
}
