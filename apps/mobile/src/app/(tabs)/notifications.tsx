import { LIMIT_DEFAULT, describeError, isUnread, type NotificationData } from '@drmayday/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { NotificationItem } from '@/components/notifications/notification-item';
import { PrimaryButton } from '@/components/primary-button';
import {
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
} from '@/lib/notifications-api';

function NotificationsList() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationData[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Chỉ nhận kết quả của lần tải mới nhất, tránh phản hồi cũ về muộn ghi đè.
  const latestRequest = useRef(0);
  const nextPage = useRef(1);

  /** reset=true tải lại từ trang đầu; ngược lại nối thêm trang kế tiếp. */
  const load = useCallback(async (reset: boolean) => {
    const requestId = ++latestRequest.current;
    const page = reset ? 1 : nextPage.current;
    setError(null);
    try {
      const result = await fetchNotifications(page, LIMIT_DEFAULT);
      if (requestId !== latestRequest.current) return;
      nextPage.current = page + 1;
      setTotal(result.total);
      setItems((current) => (reset || !current ? result.items : [...current, ...result.items]));
    } catch (e) {
      if (requestId === latestRequest.current) setError(describeError(e));
    }
  }, []);

  // Tải lại mỗi lần tab được mở để thấy thông báo mới.
  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleEndReached() {
    if (!items || items.length >= total || loadingMore || refreshing) return;
    setLoadingMore(true);
    try {
      await load(false);
    } finally {
      setLoadingMore(false);
    }
  }

  function setRead(id: string, isRead: NotificationData['is_read']) {
    setItems(
      (current) =>
        current?.map((item) => (item.id === id ? { ...item, is_read: isRead } : item)) ?? null,
    );
  }

  async function handlePress(notification: NotificationData) {
    // reference_id của đơn thuốc/xét nghiệm là id của chính chúng, không phải bệnh án,
    // nên chỉ thông báo loại medical_record mới mở được màn bệnh án.
    if (notification.type === 'medical_record' && notification.reference_id) {
      router.push({ pathname: '/records/[id]', params: { id: notification.reference_id } });
    }
    if (!isUnread(notification)) return;
    setRead(notification.id, '1');
    try {
      await markNotificationRead(notification.id);
    } catch (e) {
      setRead(notification.id, '0');
      setError(describeError(e));
    }
  }

  function confirmDelete(notification: NotificationData) {
    Alert.alert('Xoá thông báo?', 'Thông báo đã xoá sẽ không thể khôi phục.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => void handleDelete(notification.id) },
    ]);
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteNotification(id);
      setItems((current) => current?.filter((item) => item.id !== id) ?? null);
      setTotal((current) => Math.max(0, current - 1));
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Thông báo</Text>
      {error && <Banner tone="error" message={error} />}
      {!items ? (
        error ? (
          <PrimaryButton title="Thử lại" variant="secondary" onPress={() => void load(true)} />
        ) : (
          <ActivityIndicator size="large" />
        )
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          onEndReached={() => void handleEndReached()}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Bạn chưa có thông báo nào</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="large" /> : undefined}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => void handlePress(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

/** Tab đã nằm sau cổng đăng nhập của TabsLayout; AuthGate giữ cho màn này an toàn khi dùng riêng. */
export default function NotificationsScreen() {
  return (
    <AuthGate require="signed-in">
      <NotificationsList />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#f0f5ff' },
  title: { fontSize: 26, fontWeight: '700' },
  list: { gap: 12, paddingBottom: 24 },
  empty: { fontSize: 18, color: '#595959', textAlign: 'center', paddingVertical: 24 },
});
