import { UAS7_WEEK_MAX, type Uas7WeekData } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';

const DAYS_IN_WEEK = 7;

export function WeekCard({ week }: { week: Uas7WeekData }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>7 ngày gần nhất</Text>
      <Text style={styles.period}>
        {week.start_date} - {week.end_date}
      </Text>
      <Text style={styles.score}>
        {week.week_score}/{UAS7_WEEK_MAX}
      </Text>
      <Text style={styles.line}>Mức độ: {week.severity_label}</Text>
      <Text style={styles.line}>
        Đã chấm: {week.completed_days}/{DAYS_IN_WEEK} ngày
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  title: { fontSize: 20, fontWeight: '700' },
  period: { fontSize: 18, color: '#595959' },
  score: { fontSize: 32, fontWeight: '700', color: '#1d39c4' },
  line: { fontSize: 18 },
});
