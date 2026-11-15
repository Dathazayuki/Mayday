import { NOTIFICATION_TYPE_LABELS, isUnread, type NotificationData } from '@drmayday/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDisplayDateTime } from '@/lib/local-date';

interface NotificationItemProps {
  notification: NotificationData;
  onPress: () => void;
  onDelete: () => void;
}

export function NotificationItem({ notification, onPress, onDelete }: NotificationItemProps) {
  const unread = isUnread(notification);
  return (
    <View style={styles.item}>
      <Pressable
        style={styles.content}
        accessibilityRole="button"
        accessibilityLabel={unread ? `Chưa đọc: ${notification.title}` : notification.title}
        onPress={onPress}
      >
        <View style={styles.titleRow}>
          {unread && <View style={styles.dot} />}
          <Text style={[styles.title, unread && styles.unreadTitle]}>{notification.title}</Text>
        </View>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.meta}>
          {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type} ·{' '}
          {formatDisplayDateTime(notification.created_at)}
        </Text>
      </Pressable>
      <Pressable
        style={styles.delete}
        accessibilityRole="button"
        accessibilityLabel={`Xoá thông báo: ${notification.title}`}
        onPress={onDelete}
      >
        <Text style={styles.deleteText}>Xoá</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 16,
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  content: { minHeight: 56, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2f54eb' },
  title: { flexShrink: 1, fontSize: 18 },
  unreadTitle: { fontWeight: '700' },
  body: { fontSize: 18 },
  meta: { fontSize: 18, color: '#595959' },
  delete: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 18, fontWeight: '700', color: '#cf1322' },
});
