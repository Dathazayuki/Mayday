import { GENDER_OPTIONS, PASSWORD_MIN_LENGTH, describeError, type Gender } from '@drmayday/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';
import { validateSignup, type FieldErrors, type SignupValues } from '@/lib/validation';

function SignupForm() {
  const { signup } = useAuth();
  const [values, setValues] = useState<SignupValues>({
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [gender, setGender] = useState<Gender | null>(null);
  const [errors, setErrors] = useState<FieldErrors<keyof SignupValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: keyof SignupValues) => (text: string) =>
    setValues((current) => ({ ...current, [key]: text }));

  async function handleSubmit() {
    const nextErrors = validateSignup(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await signup({
        full_name: values.fullName.trim(),
        phone: values.phone,
        password: values.password,
        gender: gender ?? undefined,
      });
      router.replace({ pathname: '/login', params: { phone: values.phone, notice: 'signup' } });
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen>
      {formError && <Banner tone="error" message={formError} />}
      <FormField
        label="Họ và tên"
        value={values.fullName}
        onChangeText={setValue('fullName')}
        error={errors.fullName}
        autoComplete="name"
        maxLength={255}
      />
      <FormField
        label="Số điện thoại"
        value={values.phone}
        onChangeText={setValue('phone')}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="0912345678"
      />
      <FormField
        label="Mật khẩu"
        value={values.password}
        onChangeText={setValue('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
      />
      <FormField
        label="Nhập lại mật khẩu"
        value={values.confirmPassword}
        onChangeText={setValue('confirmPassword')}
        error={errors.confirmPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <OptionPicker
        label="Giới tính (không bắt buộc)"
        options={GENDER_OPTIONS}
        value={gender}
        onChange={setGender}
      />
      <PrimaryButton title="Đăng ký" onPress={() => void handleSubmit()} loading={submitting} />
    </FormScreen>
  );
}

export default function SignupScreen() {
  return (
    <AuthGate require="signed-out">
      <SignupForm />
    </AuthGate>
  );
}
