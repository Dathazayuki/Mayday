import {
  ApiError,
  UAS7_FIELD_LABELS,
  describeError,
  isValidUas7Score,
  type Uas7ScoreData,
} from '@drmayday/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScorePicker } from '@/components/uas7/score-picker';
import { todayLocalIso } from '@/lib/local-date';
import { submitScore } from '@/lib/uas7-api';

const DUPLICATE_DAY_CODE = '5002';

interface TodayCardProps {
  medicalRecordId: string;
  /** Điểm hôm nay đã gửi; có giá trị thì hiện chỉ đọc, không cho gửi lại. */
  submitted: Uas7ScoreData | undefined;
  /** Gọi sau khi gửi xong hoặc máy chủ báo đã chấm hôm nay, để màn cha tải lại dữ liệu. */
  onChanged: () => Promise<void>;
}

export function TodayCard({ medicalRecordId, submitted, onChanged }: TodayCardProps) {
  const [iss7, setIss7] = useState<string | null>(null);
  const [hss7, setHss7] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (iss7 === null || hss7 === null || !isValidUas7Score(iss7) || !isValidUas7Score(hss7)) {
      setError(`Vui lòng chọn ${UAS7_FIELD_LABELS.iss7} và ${UAS7_FIELD_LABELS.hss7}.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitScore({
        medical_record_id: medicalRecordId,
        score_date: todayLocalIso(),
        iss7,
        hss7,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      await onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === DUPLICATE_DAY_CODE) {
        // Đã chấm ở nơi khác: tải lại để chuyển sang trạng thái chỉ đọc.
        await onChanged();
      } else {
        setError(describeError(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hôm nay</Text>
      {submitted ? (
        <>
          <Banner tone="success" message="Bạn đã chấm điểm hôm nay." />
          <Text style={styles.line}>
            {UAS7_FIELD_LABELS.iss7}: {submitted.iss7}
          </Text>
          <Text style={styles.line}>
            {UAS7_FIELD_LABELS.hss7}: {submitted.hss7}
          </Text>
          {submitted.note ? <Text style={styles.line}>Ghi chú: {submitted.note}</Text> : null}
        </>
      ) : (
        <>
          <ScorePicker label={UAS7_FIELD_LABELS.iss7} value={iss7} onChange={setIss7} />
          <ScorePicker label={UAS7_FIELD_LABELS.hss7} value={hss7} onChange={setHss7} />
          <FormField
            label="Ghi chú (không bắt buộc)"
            value={note}
            onChangeText={setNote}
            multiline
          />
          {error && <Banner tone="error" message={error} />}
          <PrimaryButton
            title="Gửi điểm"
            onPress={() => void handleSubmit()}
            loading={submitting}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  title: { fontSize: 20, fontWeight: '700' },
  line: { fontSize: 18 },
});
