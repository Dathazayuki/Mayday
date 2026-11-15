import type { VisitData } from '@drmayday/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner } from '@/components/banner';
import { PrimaryButton } from '@/components/primary-button';
import { formatDisplayDate } from '@/lib/local-date';

interface VisitListProps {
  /** null khi đang tải hoặc tải lỗi. */
  visits: VisitData[] | null;
  error: string | null;
  onRetry: () => void;
}

/**
 * Mục chỉ đọc "Các lần khám" (spec B, mục 9.1): lần khám, ngày khám, phòng, ngày hẹn tái khám, dặn dò
 * của phiên. Bệnh nhân nhận `details: null` nên không có chẩn đoán hay ghi chú nội bộ (D-B21, MT-126).
 * Lỗi của riêng mục này không ảnh hưởng phần còn lại của màn.
 */
export function VisitList({ visits, error, onRetry }: VisitListProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Các lần khám</Text>
      {!visits && !error && <ActivityIndicator size="large" />}
      {error && (
        <>
          <Banner tone="error" message={error} />
          <PrimaryButton title="Thử lại" variant="secondary" onPress={onRetry} />
        </>
      )}
      {!error && visits && visits.length === 0 && (
        <Text style={styles.empty}>Chưa có lần khám nào.</Text>
      )}
      {visits?.map((visit) => (
        <View key={visit.visit_id} style={styles.visit}>
          <Text style={styles.visitTitle}>
            Lần {visit.visit_number} · {formatDisplayDate(visit.visit_date)}
          </Text>
          {visit.room_name ? <Text style={styles.detail}>Phòng: {visit.room_name}</Text> : null}
          {visit.next_appointment_date ? (
            <Text style={styles.detail}>
              Hẹn tái khám: {formatDisplayDate(visit.next_appointment_date)}
            </Text>
          ) : null}
          {visit.instructions ? (
            <Text style={styles.detail}>Dặn dò: {visit.instructions}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959' },
  visit: {
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  visitTitle: { fontSize: 18, fontWeight: '700' },
  detail: { fontSize: 18, color: '#595959' },
});
