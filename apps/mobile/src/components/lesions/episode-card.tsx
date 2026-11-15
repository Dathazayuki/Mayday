import { formatDisplayLesionDateTime, parseContextTags } from '@drmayday/shared';
import { Pressable, StyleSheet, Text } from 'react-native';

interface EpisodeCardProps {
  name: string;
  occurredAt: string | null;
  description: string | null;
  /** Chuỗi JSON thẻ bối cảnh (chỉ có ở danh sách theo bệnh án). */
  contextTags?: string | null;
  onPress: () => void;
}

/** Một đợt tổn thương trong danh sách; chạm để mở chi tiết. */
export function EpisodeCard({
  name,
  occurredAt,
  description,
  contextTags,
  onPress,
}: EpisodeCardProps) {
  const tags = contextTags ? (parseContextTags(contextTags) ?? []) : [];
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={styles.name}>{name}</Text>
      {occurredAt ? (
        <Text style={styles.detail}>{formatDisplayLesionDateTime(occurredAt)}</Text>
      ) : null}
      {tags.length > 0 ? <Text style={styles.detail}>{tags.join(', ')}</Text> : null}
      {description ? (
        <Text style={styles.detail} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  name: { fontSize: 18, fontWeight: '700' },
  detail: { fontSize: 18, color: '#595959' },
});
