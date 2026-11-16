import {
  describeError,
  emptySelfReportValues,
  RECORD_TYPE_LOCKED_NOTE,
  SELF_REPORT_TYPE_OPTIONS,
  selfReportCreateRequest,
  validateSelfReport,
  type RecordType,
  type SelfReportFormErrors,
  type SelfReportFormValues,
} from '@drmayday/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormScreen } from '@/components/form-screen';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';
import { SelfReportForm } from '@/components/records/self-report-form';
import { createMedicalRecord } from '@/lib/medical-records-api';

/**
 * Bệnh nhân tự khai bệnh án mới (spec B, mục 9.1; D-B30, MT-117): (1) chọn loại, bắt buộc, kèm mốc 6
 * tuần và cảnh báo không đổi được (MT-130); (2) khai các ô tự khai, đều không bắt buộc, kiểm lỗi ngay trên
 * máy (docs/01 dòng 126); (3) "Gửi" → POST /medical_records → mở chi tiết. Lỗi của API hiện ở Banner,
 * form giữ nguyên dữ liệu đã nhập.
 */
function NewRecordForm() {
  const router = useRouter();
  const [type, setType] = useState<RecordType | null>(null);
  const [values, setValues] = useState<SelfReportFormValues>(emptySelfReportValues);
  const [errors, setErrors] = useState<SelfReportFormErrors>({});
  const [typeError, setTypeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function chooseType(next: RecordType | null) {
    setType(next);
    setTypeError(null);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!type) {
      setTypeError('Vui lòng chọn loại bệnh án');
      return;
    }
    const nextErrors = validateSelfReport(type, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      const created = await createMedicalRecord(selfReportCreateRequest(type, values));
      router.replace({
        pathname: '/records/[id]',
        params: { id: String(created.medical_record_id) },
      });
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      <OptionPicker
        label="Loại bệnh án *"
        options={SELF_REPORT_TYPE_OPTIONS}
        value={type}
        onChange={chooseType}
      />
      <Text style={styles.note}>{RECORD_TYPE_LOCKED_NOTE}</Text>
      {typeError && <Banner tone="error" message={typeError} />}
      {type && <SelfReportForm type={type} values={values} errors={errors} onChange={setValues} />}
      <PrimaryButton title="Gửi" onPress={() => void handleSubmit()} loading={submitting} />
    </>
  );
}

export default function NewRecordScreen() {
  return (
    <AuthGate require="signed-in">
      <FormScreen>
        <NewRecordForm />
      </FormScreen>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 16, color: '#595959' },
});
