import {
  LESION_NAME_MAX_LENGTH,
  describeError,
  formatLesionDateTime,
  isRecordActiveForLesions,
  type LesionEpisodeData,
  type MedicalRecordHistoryItem,
} from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { FormScreen } from '@/components/form-screen';
import { ContextFields } from '@/components/lesions/context-fields';
import { LoadError } from '@/components/load-error';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';
import {
  buildContextInput,
  buildContextPatch,
  emptyContextValues,
  textOrNull,
  toContextValues,
  validateContext,
  type ContextFormErrors,
  type ContextFormValues,
} from '@/lib/lesion-form';
import { createEpisode, fetchEpisode, updateEpisode } from '@/lib/lesions-api';
import { fetchHistory } from '@/lib/medical-records-api';
import { useLoader } from '@/lib/use-loader';

interface EpisodeFormSetup {
  /** Bệnh án đang hoạt động để chọn (chỉ khi tạo mới). */
  records: MedicalRecordHistoryItem[];
  /** Đợt đang sửa; null khi tạo mới. */
  episode: LesionEpisodeData | null;
}

interface FormErrors extends ContextFormErrors {
  record?: string;
  name?: string;
}

function EpisodeForm({ setup }: { setup: EpisodeFormSetup }) {
  const router = useRouter();
  const { episode, records } = setup;
  const [recordId, setRecordId] = useState<string | null>(
    records.length === 1 ? String(records[0].medical_record_id) : null,
  );
  const [name, setName] = useState(episode?.name ?? '');
  const [description, setDescription] = useState(episode?.description ?? '');
  const [context, setContext] = useState<ContextFormValues>(() =>
    episode ? toContextValues(episode) : emptyContextValues(formatLesionDateTime(new Date())),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!episode && records.length === 0) {
    return (
      <>
        <Banner
          tone="error"
          message="Bạn cần có bệnh án đang hoạt động để theo dõi tổn thương da"
        />
        <PrimaryButton title="Tạo bệnh án" onPress={() => router.replace('/records/new')} />
      </>
    );
  }

  async function handleSubmit() {
    const nextErrors: FormErrors = validateContext(context);
    if (!episode && !recordId) nextErrors.record = 'Vui lòng chọn bệnh án';
    if (!name.trim()) nextErrors.name = 'Vui lòng nhập tên đợt tổn thương';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (episode) {
        await updateEpisode(episode.episode_id, {
          name: name.trim(),
          description: textOrNull(description),
          ...buildContextPatch(context),
        });
        router.back();
      } else if (recordId) {
        const created = await createEpisode({
          medical_record_id: recordId,
          name: name.trim(),
          ...(textOrNull(description) ? { description: description.trim() } : {}),
          ...buildContextInput(context),
        });
        router.replace({ pathname: '/lesions/[id]', params: { id: created.episode_id } });
      }
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      {!episode && records.length > 1 && (
        <>
          <OptionPicker
            label="Bệnh án"
            options={records.map((record) => ({
              value: String(record.medical_record_id),
              label: `Bệnh án #${record.medical_record_id}`,
            }))}
            value={recordId}
            onChange={setRecordId}
          />
          {errors.record && <Banner tone="error" message={errors.record} />}
        </>
      )}
      <FormField
        label="Tên đợt tổn thương *"
        value={name}
        onChangeText={setName}
        error={errors.name}
        maxLength={LESION_NAME_MAX_LENGTH}
      />
      <ContextFields
        values={context}
        errors={errors}
        occurredAtLabel="Ngày giờ xuất hiện"
        onChange={setContext}
      />
      <FormField label="Mô tả" value={description} onChangeText={setDescription} multiline />
      <PrimaryButton
        title={episode ? 'Lưu thay đổi' : 'Lưu đợt tổn thương'}
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
    </>
  );
}

function EpisodeFormLoader({ id }: { id: string | undefined }) {
  const { user } = useAuth();
  const userId = user?.user_id;
  const fetcher = useCallback(async (): Promise<EpisodeFormSetup> => {
    if (id) return { records: [], episode: await fetchEpisode(id) };
    const history = await fetchHistory(Number(userId));
    return {
      records: history.filter((record) => isRecordActiveForLesions(record.status)),
      episode: null,
    };
  }, [id, userId]);
  const { data, error, reload } = useLoader(fetcher);

  return (
    <FormScreen>
      {data ? (
        <EpisodeForm setup={data} />
      ) : error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : (
        <ActivityIndicator size="large" />
      )}
    </FormScreen>
  );
}

/** Tạo đợt tổn thương mới, hoặc sửa đợt khi có `?id=`. */
export default function EpisodeFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <AuthGate require="signed-in">
      <EpisodeFormLoader id={id} />
    </AuthGate>
  );
}
