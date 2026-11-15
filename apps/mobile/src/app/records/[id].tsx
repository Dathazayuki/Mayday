import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { formatDisplayDateTime } from '@/lib/local-date';
import { fetchMedicalRecord } from '@/lib/medical-records-api';
import { useLoader } from '@/lib/use-loader';

/**
 * Chi tiết bệnh án của bệnh nhân, tạm chỉ có tóm tắt (spec B, mục 13, B2): phiếu động đã gỡ (D-B27);
 * khối tự khai, phiên khám (B5) và sửa, huỷ (B6) làm sau. Mục xét nghiệm, tổn thương da giữ file tới C
 * nhưng không render ở đây (spec B, mục 9.2).
 */
function RecordDetailView({ id }: { id: string }) {
  const fetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const { data: record, error, reload } = useLoader(fetcher);

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

  return (
    <FormScreen>
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.line}>Tạo lúc {formatDisplayDateTime(record.created_at)}</Text>
      </View>
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
      ) : null}
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
