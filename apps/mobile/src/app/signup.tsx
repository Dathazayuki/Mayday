import {
  GENDER_OPTIONS,
  PASSWORD_MIN_LENGTH,
  describeError,
  isValidVietnamPhone,
  type Gender,
} from '@drmayday/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';

interface SignupValues {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
}
type SignupErrors = Partial<Record<keyof SignupValues, string>>;

function validate({ fullName, phone, password, confirmPassword }: SignupValues): SignupErrors {
  const errors: SignupErrors = {};
  if (!fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
  if (!phone) errors.phone = 'Vui lòng nhập số điện thoại';
  else if (!isValidVietnamPhone(phone)) {
    errors.phone = 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  }
  if (!password) errors.password = 'Vui lòng nhập mật khẩu';
  else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`;
  }
  if (!confirmPassword) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu';
  else if (confirmPassword !== password) errors.confirmPassword = 'Mật khẩu nhập lại không khớp';
  return errors;
}

function SignupForm() {
  const { signup } = useAuth();
  const [values, setValues] = useState<SignupValues>({
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [gender, setGender] = useState<Gender | null>(null);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: keyof SignupValues) => (text: string) =>
    setValues((current) => ({ ...current, [key]: text }));

  async function handleSubmit() {
    const nextErrors = validate(values);
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
