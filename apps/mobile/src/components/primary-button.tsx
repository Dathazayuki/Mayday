import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  loading,
}: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primary : styles.outlined,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#2f54eb'} />
      ) : (
        <Text style={[styles.text, textStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#2f54eb' },
  outlined: { borderWidth: 1, borderColor: '#d9d9d9', backgroundColor: '#fff' },
  pressed: { opacity: 0.85 },
  text: { fontSize: 18, fontWeight: '700' },
});

const textStyles = StyleSheet.create({
  primary: { color: '#fff' },
  secondary: { color: '#2f54eb' },
  danger: { color: '#cf1322' },
});
