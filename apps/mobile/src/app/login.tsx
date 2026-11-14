import { describeError, isValidVietnamPhone } from '@drmayday/shared';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';

function validatePhone(phone: string): string | null {
  if (!phone) return 'Vui lòng nhập số điện thoại';
  if (!isValidVietnamPhone(phone)) return 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  return null;
}

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signed-in') return <Redirect href="/home" />;

  async function handleSubmit() {
    const nextPhoneError = validatePhone(phone);
    const nextPasswordError = password ? null : 'Vui lòng nhập mật khẩu';
    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    setFormError(null);
    if (nextPhoneError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await login({ phone, password });
      router.replace('/home');
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>DrMayDay</Text>
        <Text style={styles.subtitle}>Theo dõi bệnh mề đay mỗi ngày</Text>

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <View style={styles.field}>
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={[styles.input, phoneError && styles.inputError]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0912345678"
            accessibilityLabel="Số điện thoại"
          />
          {phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            style={[styles.input, passwordError && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            accessibilityLabel="Mật khẩu"
          />
          {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Đăng nhập</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f5ff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: '#1d39c4' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#595959', marginBottom: 8 },
  formError: {
    fontSize: 16,
    color: '#a8071a',
    backgroundColor: '#fff1f0',
    padding: 12,
    borderRadius: 8,
  },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#ff4d4f' },
  fieldError: { fontSize: 14, color: '#cf1322' },
  button: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: '#2f54eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
