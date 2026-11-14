import { PASSWORD_MIN_LENGTH, describeError, type ChangePasswordRequest } from '@drmayday/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { PrimaryButton } from '@/components/primary-button';

type ChangePasswordErrors = Partial<Record<keyof ChangePasswordRequest, string>>;

function validate({
  old_password,
  new_password,
  confirm_password,
}: ChangePasswordRequest): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!old_password) errors.old_password = 'Vui lòng nhập mật khẩu hiện tại';
  if (!new_password) errors.new_password = 'Vui lòng nhập mật khẩu mới';
  else if (new_password.length < PASSWORD_MIN_LENGTH) {
    errors.new_password = `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`;
  }
  if (!confirm_password) errors.confirm_password = 'Vui lòng nhập lại mật khẩu mới';
  else if (confirm_password !== new_password) {
    errors.confirm_password = 'Mật khẩu nhập lại không khớp';
  }
  return errors;
}

function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [values, setValues] = useState<ChangePasswordRequest>({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: keyof ChangePasswordRequest) => (text: string) =>
    setValues((current) => ({ ...current, [key]: text }));

  async function handleSubmit() {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await changePassword(values);
      router.replace({ pathname: '/login', params: { notice: 'password-changed' } });
    } catch (error) {
      setFormError(describeError(error));
      setSubmitting(false);
    }
  }

  return (
    <FormScreen>
      {formError && <Banner tone="error" message={formError} />}
      <FormField
        label="Mật khẩu hiện tại"
        value={values.old_password}
        onChangeText={setValue('old_password')}
        error={errors.old_password}
        secureTextEntry
        autoComplete="current-password"
      />
      <FormField
        label="Mật khẩu mới"
        value={values.new_password}
        onChangeText={setValue('new_password')}
        error={errors.new_password}
        secureTextEntry
        autoComplete="new-password"
        placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
      />
      <FormField
        label="Nhập lại mật khẩu mới"
        value={values.confirm_password}
        onChangeText={setValue('confirm_password')}
        error={errors.confirm_password}
        secureTextEntry
        autoComplete="new-password"
      />
      <PrimaryButton
        title="Đổi mật khẩu"
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
    </FormScreen>
  );
}

export default function ChangePasswordScreen() {
  return (
    <AuthGate require="signed-in">
      <ChangePasswordForm />
    </AuthGate>
  );
}
