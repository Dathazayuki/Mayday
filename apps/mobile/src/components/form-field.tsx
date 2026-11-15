import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function FormField({ label, error, style, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        {...inputProps}
        style={[
          styles.input,
          error ? styles.inputError : null,
          inputProps.editable === false ? styles.inputDisabled : null,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 18, fontWeight: '600' },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  inputDisabled: { backgroundColor: '#f5f5f5', color: '#8c8c8c' },
  inputError: { borderColor: '#ff4d4f' },
  error: { fontSize: 18, color: '#cf1322' },
});
