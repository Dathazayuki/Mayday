import {
  describeError,
  isRecordActiveForLesions,
  type LesionEpisodeData,
  type LesionLocationData,
  type LesionPhotoListItem,
} from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { ContextSummary } from '@/components/lesions/context-summary';
import { LocationCard } from '@/components/lesions/location-card';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import {
  deleteEpisode,
  deleteLocation,
  deletePhoto,
  fetchEpisode,
  fetchLocations,
  fetchPhotos,
} from '@/lib/lesions-api';
import { fetchMedicalRecord } from '@/lib/medical-records-api';
import { useLoader } from '@/lib/use-loader';

interface EpisodeDetail {
  episode: LesionEpisodeData;
  /** Bệnh án chưa đóng thì được ghi; đã đóng chỉ xem. */
  canEdit: boolean;
  locations: { location: LesionLocationData; photos: LesionPhotoListItem[] }[];
}

async function loadDetail(id: string): Promise<EpisodeDetail> {
  const episode = await fetchEpisode(id);
  const [record, locations] = await Promise.all([
    fetchMedicalRecord(episode.medical_record_id),
    fetchLocations(id),
  ]);
  const withPhotos = await Promise.all(
    locations.map(async (location) => ({
      location,
      photos: await fetchPhotos(location.lesion_location_id),
    })),
  );
  return { episode, canEdit: isRecordActiveForLesions(record.status), locations: withPhotos };
}

function EpisodeDetailView({ id }: { id: string }) {
  const router = useRouter();
  const fetcher = useCallback(() => loadDetail(id), [id]);
  const { data, error, refreshing, reload, refresh } = useLoader(fetcher);
  const [actionError, setActionError] = useState<string | null>(null);
  // Một thao tác xoá tại một thời điểm.
  const [busy, setBusy] = useState(false);

  function confirmDelete(title: string, message: string, action: () => Promise<unknown>) {
    Alert.alert(title, message, [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => void runAction(action) },
    ]);
  }

  async function runAction(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.content}>
          {error ? (
            <LoadError message={error} onRetry={() => void reload()} />
          ) : (
            <ActivityIndicator size="large" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { episode, canEdit, locations } = data;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        {error && <Banner tone="error" message={error} />}
        {actionError && <Banner tone="error" message={actionError} />}
        <Text style={styles.title}>{episode.name}</Text>
        <ContextSummary data={episode} />
        {episode.description ? <Text style={styles.text}>{episode.description}</Text> : null}
        {!canEdit && (
          <Text style={styles.text}>Bệnh án đã đóng nên đợt tổn thương này chỉ có thể xem.</Text>
        )}
        {canEdit && (
          <>
            <PrimaryButton
              title="Sửa đợt"
              variant="secondary"
              disabled={busy}
              onPress={() => router.push({ pathname: '/lesions/new', params: { id } })}
            />
            <PrimaryButton
              title="Xoá đợt"
              variant="danger"
              loading={busy}
              onPress={() =>
                confirmDelete(
                  'Xoá đợt tổn thương?',
                  'Xoá đợt sẽ xoá cả các vị trí và ảnh tổn thương của đợt này.',
                  async () => {
                    await deleteEpisode(id);
                    router.back();
                  },
                )
              }
            />
          </>
        )}
        <Text style={styles.section}>Vị trí tổn thương</Text>
        {locations.length === 0 && <Text style={styles.text}>Chưa có vị trí nào.</Text>}
        {locations.map(({ location, photos }) => (
          <LocationCard
            key={location.lesion_location_id}
            location={location}
            photos={photos}
            canEdit={canEdit}
            busy={busy}
            onEdit={() =>
              router.push({
                pathname: '/lesions/location',
                params: { episodeId: id, id: location.lesion_location_id },
              })
            }
            onDelete={() =>
              confirmDelete('Xoá vị trí?', 'Xoá vị trí sẽ xoá cả ảnh của vị trí này', async () => {
                await deleteLocation(location.lesion_location_id);
                await reload();
              })
            }
            onAddPhoto={() =>
              router.push({
                pathname: '/lesions/photo',
                params: {
                  episodeId: id,
                  locationId: location.lesion_location_id,
                  medicalRecordId: episode.medical_record_id,
                },
              })
            }
            onEditPhoto={(photo) =>
              router.push({
                pathname: '/lesions/photo',
                params: {
                  episodeId: id,
                  locationId: location.lesion_location_id,
                  medicalRecordId: episode.medical_record_id,
                  id: photo.photo_id,
                },
              })
            }
            onDeletePhoto={(photo) =>
              confirmDelete(
                'Xoá ảnh tổn thương?',
                'Ảnh vẫn còn trong kho ảnh của bạn.',
                async () => {
                  await deletePhoto(photo.photo_id);
                  await reload();
                },
              )
            }
          />
        ))}
        {canEdit && (
          <PrimaryButton
            title="Thêm vị trí"
            onPress={() =>
              router.push({ pathname: '/lesions/location', params: { episodeId: id } })
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function EpisodeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate require="signed-in">
      <EpisodeDetailView id={id} />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f5ff' },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  section: { fontSize: 20, fontWeight: '700' },
  text: { fontSize: 18, color: '#595959' },
});
