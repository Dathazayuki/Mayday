import { describeMedication, parseContextTags, type LesionContextData } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';
import { formatDisplayLesionDateTime } from '@/lib/local-date';

/** Bối cảnh và thuốc của một đợt hoặc vị trí, chỉ hiện những mục có dữ liệu. */
export function ContextSummary({ data }: { data: LesionContextData }) {
  const tags = data.context_tags ? (parseContextTags(data.context_tags) ?? []) : [];
  const rows: [string, string | null][] = [
    ['Xuất hiện lúc', data.occurred_at ? formatDisplayLesionDateTime(data.occurred_at) : null],
    ['Bối cảnh', tags.length > 0 ? tags.join(', ') : null],
    ['Bối cảnh khác', data.context_other],
    ['Thuốc đã dùng', describeMedication(data)],
  ];
  return (
    <View style={styles.block}>
      {rows.map(([label, value]) =>
        value ? (
          <Text key={label} style={styles.row}>
            <Text style={styles.label}>{label}: </Text>
            {value}
          </Text>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  row: { fontSize: 18 },
  label: { fontWeight: '600', color: '#595959' },
});
