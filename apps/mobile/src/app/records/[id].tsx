import {
  answersToState,
  describeError,
  isPatientEditableStatus,
  type FormState,
  type LabResultRequestData,
  type MedicalRecordData,
  type TemplateDetailData,
} from '@drmayday/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { LabResultsSection } from '@/components/labs/lab-results-section';
import { DynamicForm } from '@/components/dynamic-form/dynamic-form';
import { FormScreen } from '@/components/form-screen';
import { PrimaryButton } from '@/components/primary-button';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { fetchLabResults } from '@/lib/labs-api';
import { formatDisplayDateTime } from '@/lib/local-date';
import {
  cancelMedicalRecord,
  fetchAnswers,
  fetchMedicalRecord,
  fetchTemplate,
} from '@/lib/medical-records-api';

interface RecordDetail {
  record: MedicalRecordData;
  /** Mẫu phiếu; null khi bệnh án không còn gắn mẫu. */
  template: TemplateDetailData | null;
  state: FormState;
}

async function loadDetail(id: string): Promise<RecordDetail> {
  const record = await fetchMedicalRecord(id);
  if (!record.template_id) return { record, template: null, state: {} };
  const [template, answers] = await Promise.all([
    fetchTemplate(record.template_id),
    fetchAnswers(id),
  ]);
  const questions = template.sections.flatMap((section) => section.questions);
  return { record, template, state: answersToState(questions, answers) };
}

function RecordDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [labResults, setLabResults] = useState<LabResultRequestData[] | null>(null);
  const [labError, setLabError] = useState<string | null>(null);

  // Kết quả xét nghiệm tải riêng: lỗi ở đây chỉ hiện trong mục của nó.
  const latestLabRequest = useRef(0);
  const loadLabResults = useCallback(async () => {
    const requestId = ++latestLabRequest.current;
    setLabError(null);
    try {
      const results = await fetchLabResults(id);
      if (requestId === latestLabRequest.current) setLabResults(results);
    } catch (error) {
      if (requestId === latestLabRequest.current) setLabError(describeError(error));
    }
  }, [id]);

  const load = useCallback(async () => {
    setFormError(null);
    try {
      setDetail(await loadDetail(id));
    } catch (error) {
      setFormError(describeError(error));
    }
  }, [id]);

  useEffect(() => {
    void load();
    void loadLabResults();
  }, [load, loadLabResults]);

  if (!detail) {
    return (
      <FormScreen>
        {formError ? (
          <>
            <Banner tone="error" message={formError} />
            <PrimaryButton title="Thử lại" variant="secondary" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </FormScreen>
    );
  }

  const { record, template, state } = detail;

  function confirmCancel() {
    Alert.alert('Huỷ bệnh án?', 'Bệnh án đã huỷ sẽ không thể khôi phục.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ', style: 'destructive', onPress: () => void handleCancel() },
    ]);
  }

  async function handleCancel() {
    setCancelling(true);
    setFormError(null);
    try {
      await cancelMedicalRecord(id);
      await load();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <FormScreen>
      {formError && <Banner tone="error" message={formError} />}
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.date}>Tạo lúc {formatDisplayDateTime(record.created_at)}</Text>
      </View>
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
      ) : null}
      {template && <DynamicForm template={template} state={state} readOnly />}
      <LabResultsSection
        requests={labResults}
        error={labError}
        onRetry={() => void loadLabResults()}
      />
      {isPatientEditableStatus(record.status) && (
        <PrimaryButton
          title="Huỷ bệnh án"
          variant="danger"
          onPress={confirmCancel}
          loading={cancelling}
        />
      )}
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
  date: { fontSize: 18, color: '#595959' },
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
