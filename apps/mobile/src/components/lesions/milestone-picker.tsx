import { LESION_MILESTONES, LESION_MILESTONE_LABELS, type LesionMilestone } from '@drmayday/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface MilestonePickerProps {
  value: LesionMilestone | null;
  onChange: (value: LesionMilestone) => void;
  error?: string | null;
}

/** Ba nút lớn: Khởi phát, Đỉnh điểm, Hồi phục. */
export function MilestonePicker({ value, onChange, error }: MilestonePickerProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Mốc của ảnh</Text>
      <View style={styles.row}>
        {LESION_MILESTONES.map((milestone) => {
          const selected = milestone === value;
          return (
            <Pressable
              key={milestone}
              style={[styles.button, selected && styles.buttonSelected]}
              onPress={() => onChange(milestone)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.buttonText, selected && styles.buttonTextSelected]}>
                {LESION_MILESTONE_LABELS[milestone]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: { borderColor: '#2f54eb', backgroundColor: '#f0f5ff' },
  buttonText: { fontSize: 18, color: '#262626' },
  buttonTextSelected: { color: '#1d39c4', fontWeight: '700' },
  error: { fontSize: 18, color: '#cf1322' },
});
