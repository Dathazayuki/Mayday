import {
  describeError,
  selfReportChanges,
  toSelfReportValues,
  validateSelfReport,
  type MedicalRecordData,
  type SelfReportFormErrors,
  type SelfReportFormValues,
} from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import { SelfReportForm } from '@/components/records/self-report-form';
import { fetchMedicalRecord, updateSelfReport } from '@/lib/medical-records-api';
import { useLoader } from '@/lib/use-loader';

/**
 * Form sửa phần tự khai, điền sẵn giá trị đang lưu; "Lưu thay đổi" chỉ gửi trường đã đổi (spec B, mục
 * 5.7). Không đổi gì thì quay lại, không gọi API.
 */
function EditSelfReportForm({
  record,
  onStale,
}: {
  record: MedicalRecordData;
  onStale: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SelfReportFormValues>(() =>
    toSelfReportValues(record.self_report),
  );
  const [errors, setErrors] = useState<SelfReportFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!record.allowed_actions.includes('edit')) {
    return (
      <>
        <Banner
          tone="error"
          message="Bệnh án này không còn sửa được: bác sĩ đã tiếp nhận hoặc bệnh án đã đóng."
        />
        <PrimaryButton title="Quay lại" variant="secondary" onPress={() => router.back()} />
      </>
    );
  }

  async function handleSubmit() {
    setFormError(null);
    const nextErrors = validateSelfReport(record.record_type, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const changes = selfReportChanges(record.record_type, values, record.self_report);
    // Không đổi gì thì không gọi API (như "Lưu" của Web, spec B mục 8.7).
    if (Object.keys(changes).length === 0) {
      router.back();
      return;
    }
    setSubmitting(true);
    try {
      await updateSelfReport(String(record.medical_record_id), changes);
      router.back();
    } catch (error) {
      setFormError(describeError(error));
      // Trạng thái có thể đã đổi (vd bác sĩ vừa tiếp nhận): tải lại để allowed_actions cập nhật.
      onStale();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      <SelfReportForm
        type={record.record_type}
        values={values}
        errors={errors}
        onChange={setValues}
      />
      <PrimaryButton
        title="Lưu thay đổi"
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
    </>
  );
}

/**
 * Sửa "Thông tin bạn đã khai" khi hồ sơ chưa tiếp nhận (spec B, mục 9.1; D-B30): cùng form với màn tạo,
 * gửi PATCH /medical_records/:id `{self_report}`. Hồ sơ đã tiếp nhận thì API trả 3101; màn chặn trước
 * theo `allowed_actions`.
 */
function EditSelfReportLoader({ id }: { id: string }) {
  const fetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const { data, error, reload } = useLoader(fetcher);
  return (
    <FormScreen>
      {data ? (
        <EditSelfReportForm record={data} onStale={() => void reload()} />
      ) : error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : (
        <ActivityIndicator size="large" />
      )}
    </FormScreen>
  );
}

export default function EditSelfReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate require="signed-in">
      <EditSelfReportLoader id={id} />
    </AuthGate>
  );
}
