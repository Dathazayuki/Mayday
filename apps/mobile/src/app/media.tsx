import { ApiError, describeError } from '@drmayday/shared';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrentUserId } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { LoadError } from '@/components/load-error';
import { ImageGrid, type GridImage } from '@/components/media/image-grid';
import { deleteAttachment, fetchMyAttachments } from '@/lib/media-api';
import { useLoader } from '@/lib/use-loader';

/** 2003 với HTTP 409: ảnh còn được dùng cho ảnh tổn thương da (FK RESTRICT). */
const IN_USE_MESSAGE = 'Ảnh đang được dùng cho ảnh tổn thương da. Hãy xoá ảnh tổn thương trước.';

function deleteErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code === '2003' && error.httpStatus === 409
    ? IN_USE_MESSAGE
    : describeError(error);
}

function MediaLibrary() {
  const userId = useCurrentUserId();
  const fetcher = useCallback(async () => {
    if (!userId) throw new Error('Không xác định được tài khoản');
    return fetchMyAttachments(userId);
  }, [userId]);
  const { data, error, refreshing, reload, refresh } = useLoader(fetcher);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function confirmDelete(image: GridImage) {
    Alert.alert('Xoá ảnh?', 'Ảnh sẽ bị xoá khỏi kho ảnh và không thể khôi phục.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => void handleDelete(image.id) },
    ]);
  }

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAttachment(id);
      await reload();
    } catch (e) {
      setDeleteError(deleteErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  const images: GridImage[] = (data ?? []).map((item) => ({ id: item.id, fileUrl: item.file_url }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        {error && <LoadError message={error} onRetry={() => void reload()} />}
        {deleteError && <Banner tone="error" message={deleteError} />}
        {!data ? (
          !error && <ActivityIndicator size="large" />
        ) : images.length === 0 ? (
          <Text style={styles.empty}>Kho ảnh của bạn đang trống.</Text>
        ) : (
          <ImageGrid images={images} onRemove={confirmDelete} disabled={deleting} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function MediaScreen() {
  return (
    <AuthGate require="signed-in">
      <MediaLibrary />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f5ff' },
  content: { padding: 24, gap: 16 },
  empty: { fontSize: 18, color: '#595959', textAlign: 'center', paddingVertical: 24 },
});
