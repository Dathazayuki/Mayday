import { describeError, isValidVietnamPhone, type ForgotPasswordRequest } from '@drmayday/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { PrimaryButton } from '@/components/primary-button';
import { apiClient } from '@/lib/api';

function ForgotPasswordForm() {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    let nextPhoneError: string | null = null;
    if (!phone) nextPhoneError = 'Vui lòng nhập số điện thoại';
    else if (!isValidVietnamPhone(phone)) {
      nextPhoneError = 'Số điện thoại không đúng định dạng (VD: 0912345678)';
    }
    setPhoneError(nextPhoneError);
    setFormError(null);
    if (nextPhoneError) return;

    setSubmitting(true);
    try {
      const body: ForgotPasswordRequest = { phone };
      await apiClient.post('/auth/forgot-password', body);
      setSent(true);
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <FormScreen>
        <Banner tone="success" message="Đã gửi hướng dẫn khôi phục mật khẩu" />
        <PrimaryButton title="Quay lại đăng nhập" onPress={() => router.replace('/login')} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
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
      <PrimaryButton
        title="Gửi hướng dẫn khôi phục"
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
    </FormScreen>
  );
}

export default function ForgotPasswordScreen() {
  return (
    <AuthGate require="signed-out">
      <ForgotPasswordForm />
    </AuthGate>
  );
}
