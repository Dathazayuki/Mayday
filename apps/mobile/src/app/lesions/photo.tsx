import {
  ApiError,
  SYMPTOM_SCORE_FIELDS,
  SYMPTOM_SCORE_LABELS,
  describeError,
  type LesionPhotoListItem,
} from '@drmayday/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { DatetimeFields } from '@/components/lesions/datetime-fields';
import { MilestonePicker } from '@/components/lesions/milestone-picker';
import { ScoreStepper } from '@/components/lesions/score-stepper';
import { LoadError } from '@/components/load-error';
import { AuthorizedImage } from '@/components/media/authorized-image';
import { ImageSourceButtons } from '@/components/media/image-source-buttons';
import { PrimaryButton } from '@/components/primary-button';
import type { PickedImage } from '@/lib/image-picker';
import {
  buildPhotoPatch,
  buildPhotoScores,
  newPhotoValues,
  textOrNull,
  toPhotoValues,
  validatePhotoForm,
  type PhotoFormErrors,
  type PhotoFormValues,
} from '@/lib/lesion-form';
import { createPhoto, deletePhoto, fetchPhotos, updatePhoto } from '@/lib/lesions-api';
import { uploadImage } from '@/lib/media-api';
import { useLoader } from '@/lib/use-loader';

interface PhotoFormProps {
  episodeId: string;
  locationId: string;
  medicalRecordId: string;
  /** Ảnh đang sửa; null khi thêm mới. */
  photo: LesionPhotoListItem | null;
}

function PhotoForm({ episodeId, locationId, medicalRecordId, photo }: PhotoFormProps) {
  const router = useRouter();
  const [image, setImage] = useState<PickedImage | null>(null);
  // Giữ attachment_id sau khi tải lên thành công để lần thử lại chỉ gọi POST lesion-photos.
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [values, setValues] = useState<PhotoFormValues>(() =>
    photo ? toPhotoValues(photo) : newPhotoValues(),
  );
  const [errors, setErrors] = useState<PhotoFormErrors & { image?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof PhotoFormValues>(key: K, value: PhotoFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submitNew(picked: PickedImage) {
    let attachment = attachmentId;
    if (!attachment) {
      const uploaded = await uploadImage(picked, { medical_record_id: medicalRecordId });
      attachment = uploaded.id;
      setAttachmentId(attachment);
    }
    await createPhoto({
      episode_id: episodeId,
      location_id: locationId,
      attachment_id: attachment,
      milestone: values.milestone!,
      ...(textOrNull(values.taken_at) ? { taken_at: values.taken_at.trim() } : {}),
      ...buildPhotoScores(values),
    });
  }

  async function handleSubmit() {
    const nextErrors: PhotoFormErrors & { image?: string } = validatePhotoForm(values);
    if (!photo && !image) nextErrors.image = 'Vui lòng chụp hoặc chọn một ảnh';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (photo) await updatePhoto(photo.photo_id, buildPhotoPatch(values));
      else if (image) await submitNew(image);
      router.back();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Xoá ảnh tổn thương?', 'Ảnh vẫn còn trong kho ảnh của bạn.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => void handleDelete() },
    ]);
  }

  async function handleDelete() {
    if (!photo) return;
    setFormError(null);
    try {
      await deletePhoto(photo.photo_id);
      router.back();
    } catch (error) {
      setFormError(describeError(error));
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      {photo ? (
        <AuthorizedImage fileUrl={photo.attachment.file_url} style={styles.preview} />
      ) : (
        <>
          {image && <Image source={{ uri: image.uri }} style={styles.preview} contentFit="cover" />}
          <ImageSourceButtons
            limit={1}
            disabled={submitting}
            onPicked={(images) => {
              setImage(images[0]);
              setAttachmentId(null);
              setErrors((current) => ({ ...current, image: undefined }));
            }}
          />
          {errors.image && <Text style={styles.error}>{errors.image}</Text>}
        </>
      )}
      <MilestonePicker
        value={values.milestone}
        onChange={(milestone) => set('milestone', milestone)}
        error={errors.milestone}
      />
      <View style={styles.scores}>
        {SYMPTOM_SCORE_FIELDS.map((field) => (
          <ScoreStepper
            key={field}
            label={SYMPTOM_SCORE_LABELS[field]}
            value={values[field]}
            onChange={(score) => set(field, score)}
          />
        ))}
      </View>
      <FormField
        label="Số nốt sẩn"
        value={values.hives_count}
        onChangeText={(text) => set('hives_count', text)}
        error={errors.hives_count}
        keyboardType="number-pad"
        maxLength={9}
      />
      <FormField
        label="AUAS cục bộ"
        value={values.local_auas}
        onChangeText={(text) => set('local_auas', text)}
        error={errors.local_auas}
        keyboardType="number-pad"
        maxLength={9}
      />
      {!photo && (
        <DatetimeFields
          label="Thời điểm chụp"
          value={values.taken_at}
          onChange={(value) => set('taken_at', value)}
          error={errors.taken_at}
        />
      )}
      <PrimaryButton
        title={photo ? 'Lưu thay đổi' : 'Lưu ảnh'}
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
      {photo && <PrimaryButton title="Xoá ảnh" variant="danger" onPress={confirmDelete} />}
    </>
  );
}

interface PhotoParams {
  episodeId: string;
  locationId: string;
  medicalRecordId: string;
  id?: string;
}

function PhotoFormLoader({ episodeId, locationId, medicalRecordId, id }: PhotoParams) {
  // Không có API lấy một ảnh: tìm trong danh sách ảnh của vị trí.
  const fetcher = useCallback(async (): Promise<LesionPhotoListItem | null> => {
    if (!id) return null;
    const photo = (await fetchPhotos(locationId)).find((item) => item.photo_id === id);
    if (!photo) throw new ApiError('7003', '', 404);
    return photo;
  }, [locationId, id]);
  const { data, error, reload } = useLoader(fetcher);
  const ready = !id || data !== null;

  return (
    <FormScreen>
      {ready ? (
        <PhotoForm
          episodeId={episodeId}
          locationId={locationId}
          medicalRecordId={medicalRecordId}
          photo={data}
        />
      ) : error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : (
        <ActivityIndicator size="large" />
      )}
    </FormScreen>
  );
}

/** Thêm ảnh tổn thương cho một vị trí, hoặc sửa mốc và điểm của ảnh khi có `id`. */
export default function LesionPhotoScreen() {
  const params = useLocalSearchParams<{
    episodeId: string;
    locationId: string;
    medicalRecordId: string;
    id?: string;
  }>();
  return (
    <AuthGate require="signed-in">
      <PhotoFormLoader {...params} />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  error: { fontSize: 18, color: '#cf1322' },
  scores: { gap: 12 },
});
