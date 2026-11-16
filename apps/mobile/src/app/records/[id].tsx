import { describeError, RECORD_TYPE_LABELS } from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { SelfReportSummary } from '@/components/records/self-report-summary';
import { VisitList } from '@/components/records/visit-list';
import { cancelMedicalRecord, fetchMedicalRecord, fetchVisits } from '@/lib/medical-records-api';
import { recordDateLabel } from '@/lib/record-dates';
import { useLoader } from '@/lib/use-loader';

/**
 * Chi tiết bệnh án của bệnh nhân (spec B, mục 9.1): trạng thái, loại, mốc khám, bác sĩ phụ trách; "Thông
 * tin bạn đã khai" (nút "Sửa" khi `allowed_actions` có `edit`, D-B30); "Huỷ bệnh án" khi có `cancel`
 * (D-B32); đã tiếp nhận thì chỉ xem; dặn dò của bác sĩ; các lần khám. Bệnh nhân nhận `details: null` nên
 * không có chẩn đoán của bác sĩ hay ghi chú nội bộ (MT-126). Mục xét nghiệm, tổn thương da giữ file tới
 * tiểu dự án C nhưng không render ở đây (mục 9.2).
 */
function RecordDetailView({ id }: { id: string }) {
  const router = useRouter();
  const recordFetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const visitsFetcher = useCallback(() => fetchVisits(id), [id]);
  const { data: record, error, reload } = useLoader(recordFetcher);
  const visits = useLoader(visitsFetcher);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  function confirmCancel() {
    Alert.alert('Huỷ bệnh án?', 'Bệnh án đã huỷ không thể khôi phục.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ bệnh án', style: 'destructive', onPress: () => void handleCancel() },
    ]);
  }

  async function handleCancel() {
    setCancelling(true);
    setActionError(null);
    try {
      await cancelMedicalRecord(id);
      await reload();
    } catch (e) {
      setActionError(describeError(e));
      // Trạng thái có thể đã đổi (vd bác sĩ vừa tiếp nhận): tải lại để allowed_actions cập nhật.
      void reload();
    } finally {
      setCancelling(false);
    }
  }

  const dateLabel = recordDateLabel(record);
  // Tiếp nhận mở phiên đầu, nên đã có bác sĩ phụ trách = đã tiếp nhận (D-B6): bệnh nhân chỉ xem (D-B30).
  const accepted = record.assigned_doctor_id !== null;
  const canEdit = record.allowed_actions.includes('edit');
  return (
    <FormScreen>
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.line}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
        {dateLabel ? <Text style={styles.line}>{dateLabel}</Text> : null}
        {record.assigned_doctor_name ? (
          <Text style={styles.line}>Bác sĩ phụ trách: {record.assigned_doctor_name}</Text>
        ) : null}
        {accepted ? <Text style={styles.line}>Bác sĩ đã tiếp nhận, thông tin chỉ xem</Text> : null}
      </View>
      {actionError && <Banner tone="error" message={actionError} />}
      <SelfReportSummary
        record={record}
        onEdit={
          canEdit
            ? () => router.push({ pathname: '/records/[id]/edit', params: { id } })
            : undefined
        }
      />
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
      ) : null}
      <VisitList visits={visits.data} error={visits.error} onRetry={() => void visits.reload()} />
      {record.allowed_actions.includes('cancel') ? (
        <PrimaryButton
          title="Huỷ bệnh án"
          variant="danger"
          onPress={confirmCancel}
          loading={cancelling}
        />
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
