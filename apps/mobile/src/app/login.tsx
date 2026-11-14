import { describeError, isValidVietnamPhone } from '@drmayday/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';

const NOTICES: Record<string, string> = {
  signup: 'Đăng ký thành công, mời bạn đăng nhập',
  'password-changed': 'Đổi mật khẩu thành công, vui lòng đăng nhập lại',
};

function validatePhone(phone: string): string | null {
  if (!phone) return 'Vui lòng nhập số điện thoại';
  if (!isValidVietnamPhone(phone)) return 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  return null;
}

export default function LoginScreen() {
  const { status, login } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; notice?: string }>();
  const notice = params.notice ? NOTICES[params.notice] : undefined;
  const [phone, setPhone] = useState(params.phone ?? '');
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
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>DrMayDay</Text>
          <Text style={styles.subtitle}>Theo dõi bệnh mề đay mỗi ngày</Text>

          {notice && !formError && <Banner tone="success" message={notice} />}
          {formError && <Banner tone="error" message={formError} />}

          <FormField
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            error={phoneError}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0912345678"
          />
          <FormField
            label="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry
            autoComplete="password"
          />

          <PrimaryButton
            title="Đăng nhập"
            onPress={() => void handleSubmit()}
            loading={submitting}
          />
          <PrimaryButton
            title="Quên mật khẩu?"
            variant="secondary"
            onPress={() => router.push('/forgot-password')}
          />
          <PrimaryButton
            title="Đăng ký tài khoản"
            variant="secondary"
            onPress={() => router.push('/signup')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f5ff' },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: '#1d39c4' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#595959', marginBottom: 8 },
});
