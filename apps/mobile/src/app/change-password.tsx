import {
  PASSWORD_MIN_LENGTH,
  describeError,
  type ChangePasswordRequest,
  type FieldErrors,
} from '@drmayday/shared';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { PrimaryButton } from '@/components/primary-button';
import { validateChangePassword } from '@/lib/validation';

function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const { changePassword, endSession } = useAuth();
  const [values, setValues] = useState<ChangePasswordRequest>({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<FieldErrors<keyof ChangePasswordRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: keyof ChangePasswordRequest) => (text: string) =>
    setValues((current) => ({ ...current, [key]: text }));

  async function handleSubmit() {
    const nextErrors = validateChangePassword(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await changePassword(values);
      // Báo trước cho khung bảo vệ để nó tự chuyển về /login kèm thông báo khi phiên bị xoá.
      onChanged();
      await endSession();
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
  const [changed, setChanged] = useState(false);
  return (
    <AuthGate
      require="signed-in"
      redirectHref={
        changed ? { pathname: '/login', params: { notice: 'password-changed' } } : undefined
      }
    >
      <ChangePasswordForm onChanged={() => setChanged(true)} />
    </AuthGate>
  );
}
