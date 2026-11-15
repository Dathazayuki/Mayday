import {
  CAREER_OPTIONS,
  FIELD_LIMITS,
  GENDER_OPTIONS,
  describeError,
  isPatientProfile,
  type ProfileData,
  type UpdateProfileRequest,
} from '@drmayday/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';
import { apiClient } from '@/lib/api';
import {
  PROFILE_TEXT_FIELDS,
  buildProfileUpdate,
  toFormValues,
  validateProfileForm,
  type ProfileFormErrors,
  type ProfileFormValues,
} from '@/lib/profile-form';

function ProfileForm() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [values, setValues] = useState<ProfileFormValues | null>(null);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const applyProfile = useCallback((data: ProfileData) => {
    setProfile(data);
    setValues(toFormValues(data));
  }, []);

  const loadProfile = useCallback(async () => {
    setFormError(null);
    try {
      applyProfile(await apiClient.get<ProfileData>('/profile'));
    } catch (error) {
      setFormError(describeError(error));
    }
  }, [applyProfile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!profile || !values) {
    return (
      <FormScreen>
        {formError ? (
          <>
            <Banner tone="error" message={formError} />
            <PrimaryButton title="Thử lại" variant="secondary" onPress={() => void loadProfile()} />
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </FormScreen>
    );
  }

  const setText = (key: keyof ProfileFormValues) => (text: string) =>
    setValues((current) => (current ? { ...current, [key]: text } : current));

  async function handleSubmit() {
    if (!profile || !values) return;
    const nextErrors = validateProfileForm(values);
    setErrors(nextErrors);
    setFormError(null);
    setNotice(null);
    if (Object.keys(nextErrors).length > 0) return;

    const update: UpdateProfileRequest = buildProfileUpdate(values, toFormValues(profile));
    if (Object.keys(update).length === 0) {
      setNotice('Chưa có thay đổi nào để lưu');
      return;
    }

    setSubmitting(true);
    try {
      const saved = await apiClient.put<ProfileData>('/profile', update);
      applyProfile(saved);
      setNotice('Đã lưu hồ sơ');
      // Hồ sơ đã lưu; lỗi ghi tên vào phiên chỉ làm lời chào chậm cập nhật.
      await updateUser({ full_name: saved.full_name }).catch(() => undefined);
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen>
      {formError && <Banner tone="error" message={formError} />}
      {notice && <Banner tone="success" message={notice} />}
      <FormField
        label="Họ và tên"
        value={values.full_name}
        onChangeText={setText('full_name')}
        error={errors.full_name}
        maxLength={FIELD_LIMITS.full_name}
      />
      <FormField label="Số điện thoại" value={profile.phone} editable={false} />
      <OptionPicker
        label="Giới tính"
        options={GENDER_OPTIONS}
        value={values.gender}
        onChange={(gender) => setValues((current) => current && { ...current, gender })}
      />
      {isPatientProfile(profile) && (
        <>
          <FormField
            label="Năm sinh"
            value={values.year_of_birth}
            onChangeText={setText('year_of_birth')}
            error={errors.year_of_birth}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="VD: 1990"
          />
          <OptionPicker
            label="Nghề nghiệp"
            options={CAREER_OPTIONS}
            value={values.career}
            onChange={(career) => setValues((current) => current && { ...current, career })}
          />
          {PROFILE_TEXT_FIELDS.map(({ key, label, maxLength }) => (
            <FormField
              key={key}
              label={label}
              value={values[key]}
              onChangeText={setText(key)}
              maxLength={maxLength}
            />
          ))}
          <FormField
            label="Hạn thẻ BHYT"
            value={values.health_insurance_validate}
            onChangeText={setText('health_insurance_validate')}
            error={errors.health_insurance_validate}
            placeholder="YYYY-MM-DD"
            maxLength={10}
          />
          <FormField
            label="Số điện thoại người thân"
            value={values.next_of_kin_phone}
            onChangeText={setText('next_of_kin_phone')}
            error={errors.next_of_kin_phone}
            keyboardType="phone-pad"
            placeholder="0912345678"
          />
        </>
      )}
      <PrimaryButton title="Lưu" onPress={() => void handleSubmit()} loading={submitting} />
      <PrimaryButton
        title="Kho ảnh của tôi"
        variant="secondary"
        onPress={() => router.push('/media')}
      />
    </FormScreen>
  );
}

export default function ProfileScreen() {
  return (
    <AuthGate require="signed-in">
      <ProfileForm />
    </AuthGate>
  );
}
