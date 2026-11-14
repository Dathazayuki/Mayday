import { MEDIA_MAX_BATCH_FILES, describeError } from '@drmayday/shared';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Banner } from '@/components/banner';
import { LoadError } from '@/components/load-error';
import { ImageGrid, type GridImage } from '@/components/media/image-grid';
import { ImageSourceButtons } from '@/components/media/image-source-buttons';
import type { PickedImage } from '@/lib/image-picker';
import { attachImagesToAnswer, fetchAnswerImages, unlinkAnswerImage } from '@/lib/media-api';
import { useLoader } from '@/lib/use-loader';

interface LocalProps {
  /** Lúc tạo bệnh án: chỉ giữ ảnh đã chọn ở máy, chưa có answer_id nên chưa tải lên. */
  mode: 'local';
  images: readonly PickedImage[];
  onChange: (images: PickedImage[]) => void;
}

interface RemoteProps {
  /** Ở chi tiết bệnh án: ảnh lấy từ máy chủ, thêm và gỡ trực tiếp. */
  mode: 'remote';
  medicalRecordId: string;
  questionId: string;
  /** null khi câu hỏi chưa có câu trả lời. */
  answerId: string | null;
  /** Tạo câu trả lời rỗng (MT-93) rồi trả answer_id. */
  ensureAnswerId: () => Promise<string>;
  canEdit: boolean;
}

export type AnswerImagesFieldProps = {
  title: string;
  /** Có: ô ảnh của một lựa chọn (trigger_image_upload); không: ô ảnh cấp câu hỏi. */
  optionValue?: string;
  error?: string | null;
} & (LocalProps | RemoteProps);

export function AnswerImagesField(props: AnswerImagesFieldProps) {
  return props.mode === 'local' ? (
    <LocalAnswerImages {...props} />
  ) : (
    <RemoteAnswerImages {...props} />
  );
}

function LocalAnswerImages({
  title,
  error,
  images,
  onChange,
}: AnswerImagesFieldProps & LocalProps) {
  const remaining = MEDIA_MAX_BATCH_FILES - images.length;
  const grid: GridImage[] = images.map((image) => ({ id: image.uri, localUri: image.uri }));

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      {grid.length > 0 && (
        <ImageGrid
          images={grid}
          removeLabel="Gỡ ảnh"
          onRemove={(removed) => onChange(images.filter((image) => image.uri !== removed.id))}
        />
      )}
      {remaining > 0 && (
        <ImageSourceButtons
          limit={remaining}
          onPicked={(picked) => onChange([...images, ...picked].slice(0, MEDIA_MAX_BATCH_FILES))}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function RemoteAnswerImages({
  title,
  optionValue,
  medicalRecordId,
  questionId,
  answerId,
  ensureAnswerId,
  canEdit,
}: AnswerImagesFieldProps & RemoteProps) {
  const { user } = useAuth();
  // Ref để lần tải lại ngay sau khi tạo câu trả lời thấy answer_id mới.
  const answerIdRef = useRef(answerId);
  const fetcher = useCallback(async () => {
    const id = answerIdRef.current;
    if (!id) return [];
    const items = await fetchAnswerImages(id);
    return items.filter((item) => (item.option_value ?? undefined) === optionValue);
  }, [optionValue]);
  const { data, error, reload } = useLoader(fetcher);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handlePicked(images: PickedImage[]) {
    setBusy(true);
    setActionError(null);
    try {
      const id = answerIdRef.current ?? (await ensureAnswerId());
      answerIdRef.current = id;
      await attachImagesToAnswer({
        answerId: id,
        images,
        optionValue,
        medicalRecordId,
        questionId,
        userId: user?.user_id ?? '',
      });
    } catch (e) {
      setActionError(describeError(e));
    } finally {
      setBusy(false);
    }
    await reload();
  }

  function confirmUnlink(image: GridImage) {
    Alert.alert('Gỡ ảnh?', 'Ảnh sẽ được gỡ khỏi phiếu khám nhưng vẫn còn trong kho ảnh của bạn.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Gỡ', style: 'destructive', onPress: () => void handleUnlink(image.id) },
    ]);
  }

  async function handleUnlink(linkId: string) {
    setActionError(null);
    try {
      await unlinkAnswerImage(linkId);
      await reload();
    } catch (e) {
      setActionError(describeError(e));
    }
  }

  const images: GridImage[] = (data ?? []).map((item) => ({
    id: item.id,
    fileUrl: item.attachment.file_url,
  }));
  // Chỉ xem mà không có ảnh thì không hiện ô trống.
  if (!canEdit && data && images.length === 0 && !error) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      {error && <LoadError message={error} onRetry={() => void reload()} />}
      {actionError && <Banner tone="error" message={actionError} />}
      {!data
        ? !error && <ActivityIndicator size="large" />
        : images.length > 0 && (
            <ImageGrid
              images={images}
              removeLabel="Gỡ ảnh"
              onRemove={canEdit ? confirmUnlink : undefined}
            />
          )}
      {canEdit && (
        <ImageSourceButtons
          limit={MEDIA_MAX_BATCH_FILES}
          disabled={busy}
          onPicked={(picked) => void handlePicked(picked)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  error: { fontSize: 18, color: '#cf1322' },
});
