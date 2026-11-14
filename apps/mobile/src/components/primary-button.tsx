import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Khoá nút (không đổi nhãn), VD: khi một thao tác khác đang chạy. */
  disabled?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: PrimaryButtonProps) {
  const look = variants[variant];
  const inactive = loading || disabled;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        look.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={look.textColor} />
      ) : (
        <Text style={[styles.text, { color: look.textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: { fontSize: 18, fontWeight: '700' },
});

const outlined = { borderWidth: 1, borderColor: '#d9d9d9', backgroundColor: '#fff' } as const;

// Mỗi biến thể gồm kiểu khung và màu chữ (cũng là màu vòng quay khi đang tải).
const variants = {
  primary: { container: { backgroundColor: '#2f54eb' }, textColor: '#fff' },
  secondary: { container: outlined, textColor: '#2f54eb' },
  danger: { container: outlined, textColor: '#cf1322' },
} as const;
