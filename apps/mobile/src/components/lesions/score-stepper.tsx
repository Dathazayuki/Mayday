import { SYMPTOM_SCORE_MAX, SYMPTOM_SCORE_MIN } from '@drmayday/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ScoreStepperProps {
  label: string;
  /** Chuỗi số trong SYMPTOM_SCORE_MIN..SYMPTOM_SCORE_MAX; rỗng là "Chưa chấm". */
  value: string;
  onChange: (value: string) => void;
}

/** Điểm triệu chứng: nút − / +; bấm − ở điểm thấp nhất thì trở về "Chưa chấm". */
export function ScoreStepper({ label, value, onChange }: ScoreStepperProps) {
  const score = value === '' ? null : Number(value);

  function decrease() {
    if (score === null) return;
    onChange(score <= SYMPTOM_SCORE_MIN ? '' : String(score - 1));
  }

  function increase() {
    onChange(String(score === null ? SYMPTOM_SCORE_MIN : Math.min(score + 1, SYMPTOM_SCORE_MAX)));
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.step}
        onPress={decrease}
        accessibilityRole="button"
        accessibilityLabel={`Giảm điểm ${label}`}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.value}>
        {score === null ? 'Chưa chấm' : `${score}/${SYMPTOM_SCORE_MAX}`}
      </Text>
      <Pressable
        style={styles.step}
        onPress={increase}
        accessibilityRole="button"
        accessibilityLabel={`Tăng điểm ${label}`}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 56, fontSize: 18, fontWeight: '600' },
  step: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 26, fontWeight: '700', color: '#2f54eb' },
  value: { flex: 1, fontSize: 18, textAlign: 'center' },
});
