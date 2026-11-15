import { RECORD_TYPE_LABELS } from '@drmayday/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { SelfReportSummary } from '@/components/records/self-report-summary';
import { VisitList } from '@/components/records/visit-list';
import { fetchMedicalRecord, fetchVisits } from '@/lib/medical-records-api';
import { recordDateLabel } from '@/lib/record-dates';
import { useLoader } from '@/lib/use-loader';

/**
 * Chi tiết bệnh án của bệnh nhân, chỉ đọc (spec B, mục 9.1): trạng thái, loại, mốc khám, bác sĩ phụ
 * trách; "Thông tin bạn đã khai"; dặn dò của bác sĩ; các lần khám. Bệnh nhân nhận `details: null` nên
 * không có chẩn đoán của bác sĩ hay ghi chú nội bộ (MT-126). Sửa phần tự khai và tự huỷ thuộc lát B6.
 * Mục xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render ở đây (mục 9.2).
 */
function RecordDetailView({ id }: { id: string }) {
  const recordFetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const visitsFetcher = useCallback(() => fetchVisits(id), [id]);
  const { data: record, error, reload } = useLoader(recordFetcher);
  const visits = useLoader(visitsFetcher);

  if (!record) {
    return (
      <FormScreen>
        {error ? (
          <LoadError message={error} onRetry={() => void reload()} />
        ) : (
          <ActivityIndicator size="large" />
        )}
      </FormScreen>
    );
  }

  const dateLabel = recordDateLabel(record);
  return (
    <FormScreen>
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.line}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
        {dateLabel ? <Text style={styles.line}>{dateLabel}</Text> : null}
        {record.assigned_doctor_name ? (
          <Text style={styles.line}>Bác sĩ phụ trách: {record.assigned_doctor_name}</Text>
        ) : null}
      </View>
      <SelfReportSummary record={record} />
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
      ) : null}
      <VisitList visits={visits.data} error={visits.error} onRetry={() => void visits.reload()} />
    </FormScreen>
  );
}

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate require="signed-in">
      <RecordDetailView id={id} />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, alignItems: 'flex-start' },
  line: { fontSize: 18, color: '#595959' },
  instructions: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2f54eb',
    backgroundColor: '#fff',
  },
  instructionsTitle: { fontSize: 20, fontWeight: '700', color: '#1d39c4' },
  instructionsText: { fontSize: 18, lineHeight: 26 },
});
