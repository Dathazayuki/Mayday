import { UAS7_FIELD_LABELS, UAS7_DAILY_MAX, type Uas7ScoreData } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';
import { formatDisplayDate } from '@/lib/local-date';

export function HistoryList({ scores }: { scores: Uas7ScoreData[] }) {
  return (
    <View style={styles.list}>
      <Text style={styles.title}>Lịch sử chấm điểm</Text>
      {scores.length === 0 ? (
        <Text style={styles.empty}>Bạn chưa chấm điểm ngày nào.</Text>
      ) : (
        scores.map((score) => (
          <View key={score.score_date} style={styles.item}>
            <View style={styles.header}>
              <Text style={styles.date}>{formatDisplayDate(score.score_date)}</Text>
              <Text style={styles.total}>
                {score.daily_score}/{UAS7_DAILY_MAX}
              </Text>
            </View>
            <Text style={styles.detail}>
              {UAS7_FIELD_LABELS.iss7}: {score.iss7} · {UAS7_FIELD_LABELS.hss7}: {score.hss7}
            </Text>
            {score.note ? <Text style={styles.detail}>Ghi chú: {score.note}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959', textAlign: 'center', paddingVertical: 12 },
  item: {
    gap: 4,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { fontSize: 18, fontWeight: '700' },
  total: { fontSize: 18, fontWeight: '700', color: '#1d39c4' },
  detail: { fontSize: 18, color: '#262626' },
});
