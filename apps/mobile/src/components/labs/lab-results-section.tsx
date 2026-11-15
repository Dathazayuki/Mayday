import { LAB_REQUEST_STATUS_LABELS, type LabResultRequestData } from '@drmayday/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner } from '@/components/banner';
import { PrimaryButton } from '@/components/primary-button';
import { formatDisplayDateTime } from '@/lib/local-date';

interface LabResultsSectionProps {
  /** null khi đang tải hoặc tải lỗi. */
  requests: LabResultRequestData[] | null;
  error: string | null;
  onRetry: () => void;
}

/** Mục chỉ đọc "Kết quả xét nghiệm"; lỗi của riêng mục này không ảnh hưởng phần còn lại của màn. */
export function LabResultsSection({ requests, error, onRetry }: LabResultsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Kết quả xét nghiệm</Text>
      {!requests && !error && <ActivityIndicator size="large" />}
      {error && (
        <>
          <Banner tone="error" message={error} />
          <PrimaryButton title="Thử lại" variant="secondary" onPress={onRetry} />
        </>
      )}
      {!error && requests && requests.length === 0 && (
        <Text style={styles.empty}>Chưa có chỉ định xét nghiệm nào.</Text>
      )}
      {requests?.map((request) => (
        <View key={request.id} style={styles.request}>
          <Text style={styles.status}>{LAB_REQUEST_STATUS_LABELS[request.status]}</Text>
          <Text style={styles.detail}>{formatDisplayDateTime(request.created_at)}</Text>
          {request.note ? <Text style={styles.detail}>Ghi chú: {request.note}</Text> : null}
          {request.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.testName}>{item.test_name}</Text>
              <Text style={item.result_value ? styles.result : styles.detail}>
                {item.result_value ?? 'Chưa có kết quả'}
              </Text>
              {item.result_note ? (
                <Text style={styles.detail}>Nhận xét: {item.result_note}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959' },
  request: {
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  status: { fontSize: 18, fontWeight: '700', color: '#1d39c4' },
  detail: { fontSize: 18, color: '#595959' },
  item: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  testName: { fontSize: 18, fontWeight: '700' },
  result: { fontSize: 18 },
});
