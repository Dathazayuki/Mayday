import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LoadError } from '@/components/load-error';
import { fetchRecordEpisodes } from '@/lib/lesions-api';
import { useLoader } from '@/lib/use-loader';
import { EpisodeCard } from './episode-card';

/** Mục chỉ đọc "Tổn thương da" của bệnh án; chạm vào một đợt để mở chi tiết (kể cả bệnh án đã đóng). */
export function RecordLesionsSection({ medicalRecordId }: { medicalRecordId: string }) {
  const router = useRouter();
  const fetcher = useCallback(() => fetchRecordEpisodes(medicalRecordId), [medicalRecordId]);
  const { data, error, reload } = useLoader(fetcher);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Tổn thương da</Text>
      {error && <LoadError message={error} onRetry={() => void reload()} />}
      {!data && !error && <ActivityIndicator size="large" />}
      {!error && data && data.length === 0 && (
        <Text style={styles.empty}>Chưa có đợt tổn thương nào.</Text>
      )}
      {data?.map((episode) => (
        <EpisodeCard
          key={episode.id}
          name={episode.name}
          occurredAt={episode.occurred_at}
          description={episode.description}
          contextTags={episode.context_tags}
          onPress={() => router.push({ pathname: '/lesions/[id]', params: { id: episode.id } })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959' },
});
