import { ApiError, type LesionEpisodeListItem } from '@drmayday/shared';
import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { EpisodeCard } from '@/components/lesions/episode-card';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import { fetchMyEpisodes } from '@/lib/lesions-api';
import { useLoader } from '@/lib/use-loader';

type LesionsData = { kind: 'no-record' } | { kind: 'episodes'; items: LesionEpisodeListItem[] };

/** 4002: bệnh nhân chưa có bệnh án đang hoạt động, không phải lỗi. */
async function loadLesions(): Promise<LesionsData> {
  try {
    return { kind: 'episodes', items: await fetchMyEpisodes() };
  } catch (error) {
    if (error instanceof ApiError && error.code === '4002') return { kind: 'no-record' };
    throw error;
  }
}

function LesionsContent() {
  const router = useRouter();
  const { data, error, refreshing, reload, refresh } = useLoader(loadLesions);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Text style={styles.title}>Theo dõi tổn thương da</Text>
        {error && <LoadError message={error} onRetry={() => void reload()} />}
        {!data ? (
          !error && <ActivityIndicator size="large" />
        ) : data.kind === 'no-record' ? (
          <>
            <Banner
              tone="error"
              message="Bạn cần có bệnh án đang hoạt động để theo dõi tổn thương da"
            />
            <PrimaryButton title="Tạo bệnh án" onPress={() => router.push('/records/new')} />
          </>
        ) : (
          <>
            <PrimaryButton
              title="Ghi nhận đợt tổn thương"
              onPress={() => router.push('/lesions/new')}
            />
            {data.items.length === 0 && (
              <Text style={styles.empty}>Bạn chưa ghi nhận đợt tổn thương nào.</Text>
            )}
            {data.items.map((episode) => (
              <EpisodeCard
                key={episode.episode_id}
                name={episode.name}
                occurredAt={episode.occurred_at}
                description={episode.description}
                onPress={() =>
                  router.push({ pathname: '/lesions/[id]', params: { id: episode.episode_id } })
                }
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Tab đã nằm sau cổng đăng nhập của TabsLayout; AuthGate giữ cho màn này an toàn khi dùng riêng. */
export default function LesionsScreen() {
  return (
    <AuthGate require="signed-in">
      <LesionsContent />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f5ff' },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959', textAlign: 'center', paddingVertical: 24 },
});
