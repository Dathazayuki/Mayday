import { selfReportFieldsFor, type ClinicalField, type MedicalRecordData } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';

/** Giá trị đã khai để hiển thị: lựa chọn theo nhãn tiếng Việt, số dùng dấu phẩy thập phân. */
function displayValue(field: ClinicalField, value: string | number | null): string {
  if (value === null || value === '') return 'Chưa khai';
  if (field.type === 'enum') {
    return field.options.find((option) => option.value === value)?.label ?? String(value);
  }
  return typeof value === 'number' ? String(value).replace('.', ',') : value;
}

/**
 * Khối chỉ đọc "Thông tin bạn đã khai" (khối `self_report`, D-B31, spec B mục 9.1): nhãn lấy từ bộ mô
 * tả của shared, biểu hiện bệnh chỉ ở hồ sơ mạn. Giá trị là giá trị hiện tại, kể cả khi bác sĩ đã sửa
 * (MT-126). Sửa phần tự khai thuộc lát B6.
 */
export function SelfReportSummary({
  record,
}: {
  record: Pick<MedicalRecordData, 'record_type' | 'self_report'>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Thông tin bạn đã khai</Text>
      {selfReportFieldsFor(record.record_type).map((field) => (
        <View key={field.key} style={styles.row}>
          <Text style={styles.label}>{field.label}</Text>
          <Text style={styles.value}>{displayValue(field, record.self_report[field.key])}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  title: { fontSize: 20, fontWeight: '700' },
  row: { gap: 2 },
  label: { fontSize: 16, color: '#595959' },
  value: { fontSize: 18 },
});
