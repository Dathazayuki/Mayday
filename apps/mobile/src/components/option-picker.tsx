import { Pressable, StyleSheet, Text, View } from 'react-native';

interface OptionPickerProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  /** Bấm lại lựa chọn đang chọn thì trả về null (bỏ chọn). */
  onChange: (value: T | null) => void;
}

export function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionPickerProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onChange(selected ? null : option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 18, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 56,
    minWidth: 96,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: { borderColor: '#2f54eb', backgroundColor: '#f0f5ff' },
  optionText: { fontSize: 18, color: '#262626' },
  optionTextSelected: { color: '#1d39c4', fontWeight: '700' },
});
