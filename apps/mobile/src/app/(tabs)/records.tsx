import { describeError, type MedicalRecordHistoryItem } from '@drmayday/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { Banner } from '@/components/banner';
import { PrimaryButton } from '@/components/primary-button';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { fetchHistory } from '@/lib/medical-records-api';

export default function RecordsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [records, setRecords] = useState<MedicalRecordHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setRecords(await fetchHistory(Number(user.user_id)));
    } catch (e) {
      setError(describeError(e));
    }
  }, [user]);

  // Tải lại mỗi lần tab được mở để thấy bệnh án vừa tạo hoặc vừa đổi trạng thái.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Bệnh án</Text>
      <PrimaryButton title="Tạo bệnh án mới" onPress={() => router.push('/records/new')} />
      {error && <Banner tone="error" message={error} />}
      {!records ? (
        error ? (
          <PrimaryButton title="Thử lại" variant="secondary" onPress={() => void load()} />
        ) : (
          <ActivityIndicator size="large" />
        )
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.medical_record_id)}
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Bạn chưa có bệnh án nào.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/records/[id]',
                  params: { id: String(item.medical_record_id) },
                })
              }
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Bệnh án #{item.medical_record_id}</Text>
                <RecordStatusBadge status={item.status} />
              </View>
              <Text style={styles.itemDate}>
                {new Date(item.created_at).toLocaleString('vi-VN')}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#f0f5ff' },
  title: { fontSize: 26, fontWeight: '700' },
  list: { gap: 12, paddingBottom: 24 },
  empty: { fontSize: 18, color: '#595959', textAlign: 'center', paddingVertical: 24 },
  item: {
    minHeight: 56,
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 18, fontWeight: '700' },
  itemDate: { fontSize: 16, color: '#595959' },
});
