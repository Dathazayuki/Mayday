import {
  ApiError,
  BODY_PART_MAX_LENGTH,
  describeError,
  type LesionLocationData,
  buildContextInput,
  buildContextPatch,
  emptyContextValues,
  toContextValues,
  validateContext,
  type ContextFormErrors,
  type ContextFormValues,
} from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { ContextFields } from '@/components/lesions/context-fields';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import { createLocation, fetchLocations, updateLocation } from '@/lib/lesions-api';
import { useLoader } from '@/lib/use-loader';

interface FormErrors extends ContextFormErrors {
  bodyPart?: string;
}

function LocationForm({
  episodeId,
  location,
}: {
  episodeId: string;
  location: LesionLocationData | null;
}) {
  const router = useRouter();
  const [bodyPart, setBodyPart] = useState(location?.body_part ?? '');
  const [context, setContext] = useState<ContextFormValues>(() =>
    location ? toContextValues(location) : emptyContextValues(),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const nextErrors: FormErrors = validateContext(context);
    if (!bodyPart.trim()) nextErrors.bodyPart = 'Vui lòng nhập vị trí trên cơ thể';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (location) {
        await updateLocation(location.lesion_location_id, {
          body_part: bodyPart.trim(),
          ...buildContextPatch(context),
        });
      } else {
        await createLocation({
          episode_id: episodeId,
          body_part: bodyPart.trim(),
          ...buildContextInput(context),
        });
      }
      router.back();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      <FormField
        label="Vị trí trên cơ thể *"
        value={bodyPart}
        onChangeText={setBodyPart}
        error={errors.bodyPart}
        placeholder="VD: Cánh tay trái"
        maxLength={BODY_PART_MAX_LENGTH}
      />
      <ContextFields
        values={context}
        errors={errors}
        occurredAtLabel="Ngày giờ xuất hiện tại vị trí này"
        onChange={setContext}
      />
      <PrimaryButton
        title={location ? 'Lưu thay đổi' : 'Lưu vị trí'}
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
    </>
  );
}

function LocationFormLoader({ episodeId, id }: { episodeId: string; id: string | undefined }) {
  // Không có API lấy một vị trí: tìm trong danh sách vị trí của đợt.
  const fetcher = useCallback(async (): Promise<LesionLocationData | null> => {
    if (!id) return null;
    const location = (await fetchLocations(episodeId)).find(
      (item) => item.lesion_location_id === id,
    );
    if (!location) throw new ApiError('7002', '', 404);
    return location;
  }, [episodeId, id]);
  const { data, error, reload } = useLoader(fetcher);
  const ready = !id || data !== null;

  return (
    <FormScreen>
      {ready ? (
        <LocationForm episodeId={episodeId} location={data} />
      ) : error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : (
        <ActivityIndicator size="large" />
      )}
    </FormScreen>
  );
}

/** Thêm vị trí cho đợt `episodeId`, hoặc sửa vị trí khi có `id`. */
export default function LocationFormScreen() {
  const { episodeId, id } = useLocalSearchParams<{ episodeId: string; id?: string }>();
  return (
    <AuthGate require="signed-in">
      <LocationFormLoader episodeId={episodeId} id={id} />
    </AuthGate>
  );
}
